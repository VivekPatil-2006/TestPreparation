const express = require('express');
const { listTables, startTest, submitTest, history, historyDetails, updateQuestion } = require('../controllers/testController');

const router = express.Router();

router.get('/tables', listTables);
router.post('/start', startTest);
router.post('/submit', submitTest);
router.get('/history', history);
router.get('/history/:sessionId', historyDetails);
router.put('/question', updateQuestion);

module.exports = router;
