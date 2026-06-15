const path = require('path');
const fs   = require('fs');
const db   = require('../config/db');
const { create }                  = require('xmlbuilder2');
const { sendXml, sendError }      = require('../utils/xml');
const { uploadDir }               = require('../config/multer');

const CHOICE_TYPES = ['single_choice', 'multiple_choice'];


/*  POST /api/surveys/:surveyId/responses                              */
/*  Content-Type: multipart/form-data   */
// Helper to extract a scalar value from body field (multer may give arrays)
function bodyVal(raw) {
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

// For multiple_choice, keep the full array
function bodyVals(raw) {
  if (Array.isArray(raw)) return raw;
  return raw != null ? [raw] : [];
}
// Add this helper at the top of responseController.js
function toXmlTag(name) {
  // Replace spaces and invalid chars with underscores, ensure doesn't start with a number
  let tag = String(name).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  if (/^[^a-zA-Z_]/.test(tag)) tag = '_' + tag;
  return tag;
}
  async function submitResponse(req, res) {
    try {
      const surveyId = req.params.surveyId;

      const [survey] = await db.execute('SELECT id FROM surveys WHERE id = ?', [surveyId]);
      if (!survey.length) return sendError(res, 'Survey not found', 404);

      const [questions] = await db.execute(
        'SELECT * FROM questions WHERE survey_id = ? ORDER BY sort_order',
        [surveyId]
      );

      //Unwrap nested 'response' envelope if present
      const body = req.body?.response ?? req.body ?? {};

      // Validate required fields
      for (const q of questions) {
        if (!q.required) continue;

        if (q.type === 'file') {
          const files = (req.files || []).filter(f => f.fieldname === q.name);
          if (!files.length) return sendError(res, `Required file field missing: ${q.name}`, 422);

        } else if (CHOICE_TYPES.includes(q.type)) {
          const vals = bodyVals(body[q.name]);
          if (!vals.length) return sendError(res, `Required field missing: ${q.name}`, 422);

        } else {
          const val = bodyVal(body[q.name]);
          if (!val || String(val).trim() === '') {
            return sendError(res, `Required field missing: ${q.name}`, 422);
          }
        }
      }

      // Create survey_response record
      const [rResult] = await db.execute(
        'INSERT INTO survey_responses (survey_id) VALUES (?)',
        [surveyId]
      );
      const responseId = rResult.insertId;

      // Persist answers
      for (const q of questions) {
        if (q.type === 'file') {
          const files = (req.files || []).filter(f => f.fieldname === q.name);
          for (const file of files) {
            await db.execute(
  `INSERT INTO certificates
    (response_id, original_name, stored_name, mime_type, file_size_bytes)
  VALUES (?, ?, ?, ?, ?)`,
  [responseId, file.originalname, file.path, file.mimetype, file.size]
);
          }

        } else if (CHOICE_TYPES.includes(q.type)) {
          const vals = bodyVals(body[q.name]);
          for (const v of vals) {
            await db.execute(
              'INSERT INTO response_answers (response_id, question_id, answer_text) VALUES (?, ?, ?)',
              [responseId, q.id, String(v)]
            );
          }

        } else {
          const val = bodyVal(body[q.name]);
          if (val !== null) {
            await db.execute(
              'INSERT INTO response_answers (response_id, question_id, answer_text) VALUES (?, ?, ?)',
              [responseId, q.id, String(val)]
            );
          }
        }
      }

      const root = buildResponseXml(
        create({ version: '1.0' }),
        responseId,
        questions,
        body,
        req.files || [],
        new Date()
      );

      sendXml(res, root, 201);
    } catch (err) {
      console.error(err);
      sendError(res, 'Internal server error', 500);
    }
  }
/*  GET /api/surveys/:surveyId/responses                               */

async function getResponses(req, res) {
  try {
    const surveyId = req.params.surveyId;

    const [survey] = await db.execute('SELECT id FROM surveys WHERE id = ?', [surveyId]);
    if (!survey.length) return sendError(res, 'Survey not found', 404);

    const page     = Math.max(1, parseInt(req.query.page     || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '10')));
    const email    = req.query.email || null;
    const offset   = (page - 1) * pageSize;

    // Fetch the email question for this survey (used for filtering)
    const [emailQRows] = await db.execute(
      "SELECT id FROM questions WHERE survey_id = ? AND type = 'email' LIMIT 1",
      [surveyId]
    );
    const emailQId = emailQRows[0]?.id || null;

    // Build dynamic where clause
    let where  = 'sr.survey_id = ?';
    const args = [surveyId];

    if (email && emailQId) {
      where += ' AND EXISTS (SELECT 1 FROM response_answers ra WHERE ra.response_id = sr.id AND ra.question_id = ? AND ra.answer_text LIKE ?)';
     // where += ' AND EXISTS (SELECT 1 FROM response_answers ra WHERE ra.response_id = sr.id AND ra.question_id = ? AND ra.answer LIKE ?)';
      args.push(emailQId, `%${email}%`);
    }

    const [[{ total }]] = await db.execute(
      `SELECT COUNT(*) as total FROM survey_responses sr WHERE ${where}`,
      args
    );

    const [responses] = await db.execute(
      `SELECT sr.id, sr.submitted_at FROM survey_responses sr WHERE ${where}
       ORDER BY sr.submitted_at DESC LIMIT ? OFFSET ?`,
      [...args, pageSize, offset]
    );

    const lastPage = Math.max(1, Math.ceil(total / pageSize));

    // Fetch questions for this survey
    const [questions] = await db.execute(
      'SELECT * FROM questions WHERE survey_id = ? ORDER BY sort_order',
      [surveyId]
    );

    const root = create({ version: '1.0' }).ele('question_responses', {
      current_page: page,
      last_page:    lastPage,
      page_size:    pageSize,
      total_count:  total,
    });

    for (const r of responses) {
      // Fetch answers
      const [answers] = await db.execute(
        'SELECT question_id, answer_text FROM response_answers WHERE response_id = ?',
        [r.id]
      );
      const answerMap = {};
      for (const a of answers) answerMap[a.question_id] = a.answer_text; // ← was a.answer
      // const answerMap = {};
      // for (const a of answers) answerMap[a.question_id] = a.answer;

      // Fetch certificates
      const [certs] = await db.execute(
        'SELECT id, original_name FROM certificates WHERE response_id = ? ORDER BY id',
        [r.id]
      );

      appendResponseElement(root, r, questions, answerMap, certs);
    }

    sendXml(res, root);
  } catch (err) {
    console.error(err);
    sendError(res, 'Internal server error', 500);
  }
}


//  GET /api/certificates/:id                                         

async function downloadCertificate(req, res) {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM certificates WHERE id = ?',
      [req.params.id]
    );
    if (!rows.length) return sendError(res, 'Certificate not found', 404);

    const cert = rows[0];
    if (!fs.existsSync(cert.stored_path)) return sendError(res, 'File not found on server', 404);

    res.download(cert.stored_path, cert.original_name);
  } catch (err) {
    console.error(err);
    sendError(res, 'Internal server error', 500);
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Build a <question_response> element on the given parent for an
 * in-flight submission (from multipart form data).
 */
function buildResponseXml(parent, responseId, questions, body, files, submittedAt) {
  const qr = parent.ele('question_response');
  qr.ele('response_id').txt(String(responseId)).up();

  for (const q of questions) {
    if (q.type === 'file') {
      const certFiles = files.filter(f => f.fieldname === q.name);
      if (certFiles.length) {
        const certsEle = qr.ele('certificates');
        for (const f of certFiles) {
          certsEle.ele('certificate').txt(f.originalname).up();
        }
      }
    } else {
      const val = body[q.name];
      if (val !== undefined && val !== null) {
        qr.ele(q.name).txt(String(val)).up();
      }
    }
  }

  qr.ele('date_responded').txt(
    submittedAt.toISOString().replace('T', ' ').slice(0, 19)
  ).up();

  return parent;
}

/**
 * Append a <question_response> to an existing parent element from
 * persisted DB data.
 */
function appendResponseElement(root, r, questions, answerMap, certs) {
  const responseEl = root.ele('question_response');
  responseEl.ele('response_id').txt(String(r.id));
  responseEl.ele('date_responded').txt(String(r.submitted_at));

  for (const q of questions) {
    const tag = toXmlTag(q.name); // ← sanitize here
    const val = answerMap[q.id] ?? '';
    responseEl.ele(tag).txt(String(val));
  }

  // certificates
  if (certs.length) {
    const certsEl = responseEl.ele('certificates');
    for (const c of certs) {
      certsEl.ele('certificate', { id: c.id }).txt(c.original_name);
    }
  }
}
// function appendResponseElement(parent, response, questions, answerMap, certs) {
//   const qr = parent.ele('question_response');
//   qr.ele('response_id').txt(String(response.id)).up();

//   for (const q of questions) {
//     if (q.type === 'file') continue; // handled below
//     const ans = answerMap[q.id];
//     if (ans !== undefined && ans !== null) {
//       qr.ele(q.name).txt(String(ans)).up();
//     }
//   }

//   if (certs.length) {
//     const certsEle = qr.ele('certificates');
//     for (const c of certs) {
//       certsEle.ele('certificate', { id: c.id }).txt(c.original_name).up();
//     }
//   }

//   const dt = new Date(response.submitted_at);
//   qr.ele('date_responded').txt(
//     dt.toISOString().replace('T', ' ').slice(0, 19)
//   ).up();
// }

module.exports = { submitResponse, getResponses, downloadCertificate };
