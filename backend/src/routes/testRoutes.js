const express = require('express');
const { listTables, startTest, submitTest, history } = require('../controllers/testController');

const router = express.Router();

router.get('/tables', listTables);
router.post('/start', startTest);
router.post('/submit', submitTest);
router.get('/history', history);

module.exports = router;
