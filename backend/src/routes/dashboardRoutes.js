const express = require('express');
const { getAnalytics, getSubmissionMonth } = require('../controllers/analyticsController');
const { fetchNote, updateNote } = require('../controllers/dashboardController');

const router = express.Router();

router.get('/analytics', getAnalytics);
router.get('/submissions', getSubmissionMonth);
router.get('/note', fetchNote);
router.put('/note', updateNote);

module.exports = router;
