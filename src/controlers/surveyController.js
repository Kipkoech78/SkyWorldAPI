const db = require('../config/db');
const { create } = require('xmlbuilder2');
const { sendXml, sendError } = require('../utils/xml');


 // POST /api/surveys                                                   

async function createSurvey(req, res) {
  try {
    const survey = req.xmlBody?.survey  || req.body?.survey;
   // console.log(" survey posted data", survey)
    if (!survey || !survey.name) {
      return sendError(res, 'Survey name is required', 422);
    }

    const name = Array.isArray(survey.name ) ? survey.name[0] : survey.name;
    const description = Array.isArray(survey.description) ? survey.description[0] : (survey.description || "") ;

    const [result] = await db.execute(
      'INSERT INTO surveys (name, description) VALUES (?, ?)',
      [name, description]
    );

    const root = create({ version: '1.0' })
      .ele('survey', { id: result.insertId })
        .ele('name').txt(name).up()
        .ele('description').txt(description).up()
      .up();

    return sendXml(res, root, 201);

  } catch (err) {
    console.error(err);
    return sendError(res, 'Internal server error', 500);
  }
}

//  GET /api/surveys                                                    

async function getSurveys(req, res) {
  try {
    const [rows] = await db.execute('SELECT * FROM surveys');

    console.log('ROWS FROM DB:', rows); // DEBUG

    const root = create({ version: '1.0' }).ele('surveys');

    for (const row of rows) {
      root.ele('survey', { id: row.id })
        .ele('name').txt(row.name).up()
        .ele('description').txt(row.description || '').up()
      .up();
    }

    return sendXml(res, root, 200);

  } catch (err) {
    console.error(err);
    return sendError(res, 'Internal server error', 500);
  }
}

//  GET /api/surveys/:id                                               

async function getSurveyById(req, res) {
  try {
    const [rows] = await db.execute('SELECT * FROM surveys WHERE id = ?', [req.params.id]);
    if (!rows.length) return sendError(res, 'Survey not found', 404);

    const s    = rows[0];
    const root = create({ version: '1.0' })
      .ele('survey', { id: s.id })
        .ele('name').txt(s.name).up()
        .ele('description').txt(s.description || '').up();

    sendXml(res, root);
  } catch (err) {
    console.error(err);
    sendError(res, 'Internal server error', 500);
  }
}


//  PUT /api/surveys/:id          
async function updateSurvey(req, res) {
  try {
    const [exists] = await db.execute('SELECT id FROM surveys WHERE id = ?', [req.params.id]);
    if (!exists.length) return sendError(res, 'Survey not found', 404);

    const body = req.xmlBody?.survey || req.body?.survey;
    //console.log("update body", body)
    const name = Array.isArray(body.name ) ? body.name[0] : body.name;
    const description = Array.isArray(body.description) ? body.description[0] : (body.description || "") ;

    if (!name) return sendError(res, 'Survey name is required', 422);

    await db.execute(
      'UPDATE surveys SET name = ?, description = ? WHERE id = ?',
      [name, description || '', req.params.id]
    );

    const [rows] = await db.execute('SELECT * FROM surveys WHERE id = ?', [req.params.id]);
    const s      = rows[0];
    const root   = create({ version: '1.0' })
      .ele('survey', { id: s.id })
        .ele('name').txt(s.name).up()
        .ele('description').txt(s.description || '').up();

    sendXml(res, root);
  } catch (err) {
    console.error(err);
    sendError(res, 'Internal server error', 500);
  }
}


// DELETE /api/surveys/:id                                           
async function deleteSurvey(req, res) {
  try {
    const [exists] = await db.execute('SELECT id FROM surveys WHERE id = ?', [req.params.id]);
    if (!exists.length) return sendError(res, 'Survey not found', 404);

    await db.execute('DELETE FROM surveys WHERE id = ?', [req.params.id]);

    const root = create({ version: '1.0' }).ele('message').txt('Survey deleted');
    sendXml(res, root);
  } catch (err) {
    console.error(err);
    sendError(res, 'Internal server error', 500);
  }
}

module.exports = { createSurvey, getSurveys, getSurveyById, updateSurvey, deleteSurvey };
