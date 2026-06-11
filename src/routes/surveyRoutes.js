const express = require('express');
const { createSurvey, getSurveys, getSurveyById, updateSurvey, deleteSurvey } = require('../controlers/surveyController');
const { upload }   = require('../config/multer');
const { createQuestion, deleteQuestion, getQuestion, updateQuestion, getQuestions } = require('../controlers/questionController');
const { submitResponse, getResponses, downloadCertificate } = require('../controlers/responseController');
const router = express.Router();

router.post('/surveys', createSurvey)
router.get('/surveys',getSurveys)
router.get('/survey/:id', getSurveyById)
router.put('/survey/:id',updateSurvey)
router.delete('/survey/:id', deleteSurvey)


/* ------------------------------------------------------------------ */
/*  Question routes                                                     */
/* ------------------------------------------------------------------ */
router.post  ('/surveys/:surveyId/questions',     createQuestion);
router.get   ('/surveys/:surveyId/questions',     getQuestions);
router.get   ('/surveys/:surveyId/questions/:id', getQuestion);
router.put   ('/surveys/:surveyId/questions/:id', updateQuestion);
router.delete('/surveys/:surveyId/questions/:id', deleteQuestion);

/* ------------------------------------------------------------------ */
/*  Response routes                                                     */
/* ------------------------------------------------------------------ */
// Accept any file field; multer stores them all
router.post('/surveys/:surveyId/responses',
  upload.any(),
  submitResponse
);
router.get('/surveys/:surveyId/responses', getResponses);

/* ------------------------------------------------------------------ */
/*  Certificate download                                                */
/* ------------------------------------------------------------------ */
router.get('/certificates/:id', downloadCertificate);



module.exports = router;