const multer = require('multer');
const { processCsvUpload } = require('../services/uploadService');

// File upload constraints
const UPLOAD_CONSTRAINTS = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedMimeTypes: ['text/csv', 'application/vnd.ms-excel', 'application/octet-stream'],
  maxFileSizeMB: 50,
};

// Configure multer with file size limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: UPLOAD_CONSTRAINTS.maxFileSize,
  },
  fileFilter: (req, file, cb) => {
    // Check file extension
    const originalName = file.originalname.toLowerCase();
    if (!originalName.endsWith('.csv')) {
      return cb(
        new Error('Invalid file format. Only CSV files are accepted.'),
        false
      );
    }

    // Check MIME type (fallback validation)
    if (
      !UPLOAD_CONSTRAINTS.allowedMimeTypes.includes(file.mimetype) &&
      file.mimetype !== ''
    ) {
      // Allow empty mimetype as some CSV files may have it
      return cb(
        new Error('Invalid file MIME type. Only CSV files are accepted.'),
        false
      );
    }

    cb(null, true);
  },
});

const uploadCsv = async (req, res, next) => {
  try {
    if (!req.file) {
      const error = new Error('CSV file is required.');
      error.statusCode = 400;
      return next(error);
    }

    // Additional validation
    const fileName = req.file.originalname.toLowerCase();
    if (!fileName.endsWith('.csv')) {
      const error = new Error(`Invalid file format "${req.file.originalname}". Please upload a CSV file.`);
      error.statusCode = 400;
      return next(error);
    }

    // Check file size is not empty
    if (req.file.size === 0) {
      const error = new Error('The uploaded file is empty. Please select a file with data.');
      error.statusCode = 400;
      return next(error);
    }

    // Check file size doesn't exceed limit
    if (req.file.size > UPLOAD_CONSTRAINTS.maxFileSize) {
      const fileSizeMB = (req.file.size / (1024 * 1024)).toFixed(2);
      const error = new Error(
        `File size (${fileSizeMB}MB) exceeds the maximum limit of ${UPLOAD_CONSTRAINTS.maxFileSizeMB}MB.`
      );
      error.statusCode = 413;
      return next(error);
    }

    const shouldStreamProgress = req.query.progress === '1';

    if (shouldStreamProgress) {
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const emit = (payload) => {
        res.write(`${JSON.stringify(payload)}\n`);
      };

      emit({ type: 'start' });

      const result = await processCsvUpload(req.file.originalname, req.file.buffer, (progress) => {
        emit({
          type: 'progress',
          scannedCount: progress.scannedCount,
          totalRows: progress.totalRows,
          insertedCount: progress.insertedCount,
        });
      });

      emit({ type: 'complete', result });
      return res.end();
    }

    const result = await processCsvUpload(req.file.originalname, req.file.buffer);
    return res.status(200).json(result);
  } catch (error) {
    if (req.query.progress === '1' && !res.headersSent) {
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
    }

    if (req.query.progress === '1' && !res.writableEnded) {
      res.write(
        `${JSON.stringify({
          type: 'error',
          message: error.message || 'Upload failed',
          statusCode: error.statusCode || 500,
        })}\n`
      );
      return res.end();
    }

    return next(error);
  }
};

module.exports = {
  upload,
  uploadCsv,
  UPLOAD_CONSTRAINTS,
};
