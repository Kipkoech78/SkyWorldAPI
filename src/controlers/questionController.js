const db = require('../config/db');
const { create } = require('xmlbuilder2');
const { sendXml, sendError, boolAttr } = require('../utils/xml');


const VALID_TYPES = ['short_text', 'long_text', 'email', 'single_choice', 'multiple_choice', 'file'];
const CHOICE_TYPES = ['single_choice', 'multiple_choice'];


// Helpers                                                             

function firstOf(val) {
  return Array.isArray(val) ? val[0] : val;
}

function attrsOf(val) {
  const node = firstOf(val);
  return (node && node.$) ? node.$ : {};
}


// Build <question> XML response element                          

function buildQuestionElement(parent, q, options = []) {
  //const qType = CHOICE_TYPES.includes(q.type) ? 'choice' : q.type;
//  const qType = q.type;

  const qEle = parent.ele('question', {
    id: q.id,
    name: q.name,
    type: q.type,
    required: boolAttr(q.required),
  });

  qEle.ele('text').txt(q.text || '').up();
  qEle.ele('description').txt(q.description || '').up();

  if (CHOICE_TYPES.includes(q.type) || options.length) {
    const multiple =
      q.multiple === 'true' ||
        q.multiple === 'yes' ||
        q.type === 'multiple_choice'
        ? 1
        : 0;
    const optsEle = qEle.ele('options', { multiple });
    for (const opt of options) {
      optsEle.ele('option', { value: opt.value }).txt(opt.label).up();
    }
  }

  if (q.type === 'file') {
    qEle.ele('file_properties', {
      format: q.file_format || '.pdf',
      max_file_size: q.file_max_size || 1,
      max_file_size_unit: q.file_max_size_unit || 'mb',
      multiple: boolAttr(q.file_multiple),
    }).up();
  }

  return qEle;
}


//  POST /api/surveys/:surveyId/questions                

async function createQuestion(req, res) {
  try {
    const surveyId = req.params.surveyId;

    const [survey] = await db.execute(
      'SELECT id FROM surveys WHERE id = ?',
      [surveyId]
    );
    if (!survey.length) return sendError(res, 'Survey not found', 404);

    const body = req.body?.question || {};
    const attrs = body.$ || {};

   console.log('[createQuestion] raw body:', JSON.stringify(body, null, 2));

   
    const typeFrmBody = attrs.type || '';
   // console.log("type is", type)

    const multiple =
      attrs.multiple === 'true' ||
        attrs.multiple === 'yes' ||
        typeFrmBody === 'multiple_choice'
        ? 1
        : 0;
    const name = attrs.name || null;
    const required = attrs.required === 'yes' ? 1 : 0;
    const text = firstOf(body.text) || '';
    const description = firstOf(body.description) || '';

    if (!name) return sendError(res, 'Question name is required', 422);

    // ── 4. Sort order ────────────────────────────────────────────────
    const [[{ maxOrder }]] = await db.execute(
      'SELECT COALESCE(MAX(sort_order), -1) AS maxOrder FROM questions WHERE survey_id = ?',
      [surveyId]
    );

    // ── 5. File properties ───────────────────────────────────────────
    let fileFormat = null, fileMaxSize = null, fileMaxSizeUnit = null, fileMultiple = null;
    if (typeFrmBody === 'file') {
      const fp = attrsOf(body.file_properties);
      fileFormat = fp.format || '.pdf';
      fileMaxSize = parseInt(fp.max_file_size) || 1;
      fileMaxSizeUnit = fp.max_file_size_unit || 'mb';
      fileMultiple = fp.multiple === 'yes' ? 1 : 0;
    }

    // ── 6. Insert question ───────────────────────────────────────────
    const [result] = await db.execute(
      `INSERT INTO questions
         (survey_id, name, type, multiple, text, description, required, sort_order,
          file_format, file_max_size, file_max_size_unit, file_multiple)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        surveyId, name, typeFrmBody, multiple,text, description, required, maxOrder + 1,
        fileFormat, fileMaxSize, fileMaxSizeUnit, fileMultiple,
      ]
    );

    const questionId = result.insertId;
    if (CHOICE_TYPES.includes(typeFrmBody)) {
      const optionsNode = firstOf(body.options);   // { $: {...}, option: [...] }
      const rawOptions = optionsNode?.option || [];
      const optArr = Array.isArray(rawOptions) ? rawOptions : [rawOptions];

      //console.log('[createQuestion] optArr:', JSON.stringify(optArr, null, 2));

      for (let i = 0; i < optArr.length; i++) {
        const opt = optArr[i]; // xml2js: { $: { value: 'JS' }, _: 'JavaScript' }

        // opt._ is the text content, opt.$.value is the attribute
        const value = (typeof opt === 'object' ? opt?.$?.value : opt) || '';
        const label = (typeof opt === 'object' ? opt?._ : opt) || value;

        if (!value) {
          console.warn(`[createQuestion] skipping option at index ${i} — missing value`);
          continue;
        }

        await db.execute(
          `INSERT INTO question_options
   (
     question_id,
     value,
     label,
     multiple,
     sort_order
   )
   VALUES (?, ?, ?, ?, ?)`,
          [
            questionId,
            value,
            label,
            multiple,
            i
          ]
        );;
      }
    }

    // ── 8. Fetch back and respond ────────────────────────────────────
    const [qRows] = await db.execute(
      'SELECT * FROM questions WHERE id = ?',
      [questionId]
    );

    console.log("Type from bdy", typeFrmBody)
    const [opts] = CHOICE_TYPES.includes(typeFrmBody)
      ? await db.execute(
        'SELECT * FROM question_options WHERE question_id = ? ORDER BY sort_order',
        [questionId]
      )
      : [[]];

    const root = create({ version: '1.0' });
    buildQuestionElement(root, qRows[0], opts);
    return sendXml(res, root, 201);

  } catch (err) {
    console.error('[createQuestion] error:', err);
    return sendError(res, 'Internal server error', 500);
  }
}


//  GET /api/surveys/:surveyId/questions                         

async function getQuestions(req, res) {
  try {
    const surveyId = req.params.surveyId;

    const [survey] = await db.execute('SELECT id FROM surveys WHERE id = ?', [surveyId]);
    if (!survey.length) return sendError(res, 'Survey not found', 404);

    const [questions] = await db.execute(
      'SELECT * FROM questions WHERE survey_id = ? ORDER BY sort_order',
      [surveyId]
    );

    const root = create({ version: '1.0' }).ele('questions');

    for (const q of questions) {
      let opts = [];
      if (CHOICE_TYPES.includes(q.type)) {
        const [o] = await db.execute(
          'SELECT * FROM question_options WHERE question_id = ? ORDER BY sort_order',
          [q.id]
        );
        opts = o;
      }
      buildQuestionElement(root, q, opts);
    }

    sendXml(res, root);
  } catch (err) {
    console.error(err);
    sendError(res, 'Internal server error', 500);
  }
}

//  GET /api/surveys/:surveyId/questions/:id                           
async function getQuestion(req, res) {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM questions WHERE id = ? AND survey_id = ?',
      [req.params.id, req.params.surveyId]
    );
    if (!rows.length) return sendError(res, 'Question not found', 404);

    const q = rows[0];
    let opts = [];
    if (CHOICE_TYPES.includes(q.type)) {
      const [o] = await db.execute(
        'SELECT * FROM question_options WHERE question_id = ? ORDER BY sort_order',
        [q.id]
      );
      opts = o;
    }

    const root = create({ version: '1.0' });
    buildQuestionElement(root, q, opts);
    sendXml(res, root);
  } catch (err) {
    console.error(err);
    sendError(res, 'Internal server error', 500);
  }
}

// PUT /api/surveys/:surveyId/questions/:id                         
async function updateQuestion(req, res) {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM questions WHERE id = ? AND survey_id = ?',
      [req.params.id, req.params.surveyId]
    );
    if (!rows.length) return sendError(res, 'Question not found', 404);

    const existing = rows[0];
    const body = req.xmlBody?.question || {};
    const attrs = body.$ || {};

    let type = attrs.type || existing.type;
    if (type === 'choice') {
      const multiple = body.options?.$.multiple;
      type = multiple === 'yes' ? 'multiple_choice' : 'single_choice';
    }

    const name = attrs.name || existing.name;
    const required = attrs.required !== undefined ? (attrs.required === 'yes' ? 1 : 0) : existing.required;
    const text = body.text || existing.text;
    const description = body.description !== undefined ? body.description : existing.description;

    let fileFormat = existing.file_format;
    let fileMaxSize = existing.file_max_size;
    let fileMaxSizeUnit = existing.file_max_size_unit;
    let fileMultiple = existing.file_multiple;

    if (type === 'file' && body.file_properties) {
      const fp = body.file_properties.$ || {};
      fileFormat = fp.format || fileFormat;
      fileMaxSize = parseInt(fp.max_file_size) || fileMaxSize;
      fileMaxSizeUnit = fp.max_file_size_unit || fileMaxSizeUnit;
      fileMultiple = fp.multiple === 'yes' ? 1 : 0;
    }

    await db.execute(
      `UPDATE questions SET name=?, type=?, text=?, description=?, required=?,
        file_format=?, file_max_size=?, file_max_size_unit=?, file_multiple=?
       WHERE id=?`,
      [name, type, text, description, required,
        fileFormat, fileMaxSize, fileMaxSizeUnit, fileMultiple,
        req.params.id]
    );

    // Replace options if provided
    if (CHOICE_TYPES.includes(type) && body.options) {
      await db.execute('DELETE FROM question_options WHERE question_id = ?', [req.params.id]);

      const rawOptions = body.options.option || [];
      const optArr = Array.isArray(rawOptions) ? rawOptions : [rawOptions];
      for (let i = 0; i < optArr.length; i++) {
        const opt = optArr[i];
        const value = typeof opt === 'object' ? (opt.$.value || opt._) : opt;
        const label = typeof opt === 'object' ? opt._ : opt;
        await db.execute(
          'INSERT INTO question_options (question_id, value, label, sort_order) VALUES (?, ?, ?, ?)',
          [req.params.id, value, label, i]
        );
      }
    }

    const [updated] = await db.execute('SELECT * FROM questions WHERE id = ?', [req.params.id]);
    const [opts] = CHOICE_TYPES.includes(type)
      ? await db.execute('SELECT * FROM question_options WHERE question_id = ? ORDER BY sort_order', [req.params.id])
      : [[]];

    const root = create({ version: '1.0' });
    buildQuestionElement(root, updated[0], opts);
    sendXml(res, root);
  } catch (err) {
    console.error(err);
    sendError(res, 'Internal server error', 500);
  }
}

// DELETE /api/surveys/:surveyId/questions/:id        
async function deleteQuestion(req, res) {
  try {
    const [rows] = await db.execute(
      'SELECT id FROM questions WHERE id = ? AND survey_id = ?',
      [req.params.id, req.params.surveyId]
    );
    if (!rows.length) return sendError(res, 'Question not found', 404);

    await db.execute('DELETE FROM questions WHERE id = ?', [req.params.id]);

    const root = create({ version: '1.0' }).ele('message').txt('Question deleted');
    sendXml(res, root);
  } catch (err) {
    console.error(err);
    sendError(res, 'Internal server error', 500);
  }
}

module.exports = {
  createQuestion, getQuestions, getQuestion, updateQuestion, deleteQuestion,
};
