const express = require('express');
const { askDoubt, getModels } = require('../controllers/aiController');

const router = express.Router();

router.post('/doubt', askDoubt);
router.get('/models', getModels);

module.exports = router;
