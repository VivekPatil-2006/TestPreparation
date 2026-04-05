const express = require('express');
const { listTables, startTest, submitTest, history, updateQuestion } = require('../controllers/testController');

const router = express.Router();

router.get('/tables', listTables);
router.post('/start', startTest);
router.post('/submit', submitTest);
router.get('/history', history);
router.put('/question', updateQuestion);

module.exports = router;
