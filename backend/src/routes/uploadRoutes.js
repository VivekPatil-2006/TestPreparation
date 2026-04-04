const express = require('express');
const { upload, uploadCsv } = require('../controllers/uploadController');

const router = express.Router();

router.post('/csv', upload.single('file'), uploadCsv);

module.exports = router;
