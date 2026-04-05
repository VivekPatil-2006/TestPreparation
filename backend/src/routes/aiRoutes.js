const express = require('express');
const { askDoubt } = require('../controllers/aiController');

const router = express.Router();

router.post('/doubt', askDoubt);

module.exports = router;
