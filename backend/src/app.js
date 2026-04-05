const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const authMiddleware = require('./middlewares/authMiddleware');

const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const testRoutes = require('./routes/testRoutes');
const aiRoutes = require('./routes/aiRoutes');

const app = express();

const normalizeOrigin = (value) => String(value || '').trim().replace(/\/+$/, '');
const allowedOrigins = new Set((env.frontendOrigins || []).map((origin) => normalizeOrigin(origin)));
const isTrustedPreviewOrigin = (origin) => {
  try {
    const parsed = new URL(origin);
    return parsed.protocol === 'https:' && /(^|\.)vercel\.app$/i.test(parsed.hostname);
  } catch (error) {
    return false;
  }
};

app.use(
	cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = normalizeOrigin(origin);
      if (allowedOrigins.has(normalizedOrigin) || isTrustedPreviewOrigin(normalizedOrigin)) {
        return callback(null, true);
      }

      return callback(new Error('CORS origin not allowed'));
    },
		credentials: true,
	})
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.status(200).json({
    name: 'TestPreparation API',
    status: 'ok',
    health: '/api/health',
  });
});

app.get('/api/health', (req, res) => {
	res.status(200).json({
		status: 'ok',
		environment: env.nodeEnv,
	});
});

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/upload', authMiddleware, uploadRoutes);
app.use('/api/test', authMiddleware, testRoutes);
app.use('/api/ai', authMiddleware, aiRoutes);

app.use((error, req, res, next) => {
  // Handle multer file size errors
  if (error.code === 'LIMIT_FILE_SIZE') {
    const message = 'File size exceeds the maximum limit of 50MB. Please upload a smaller file.';
    return res.status(413).json({ message });
  }

  // Handle multer field size errors
  if (error.code === 'LIMIT_FIELD_SIZE') {
    const message = 'Field size exceeds the maximum limit. Please try a smaller file.';
    return res.status(413).json({ message });
  }

  // Handle other multer errors
  if (error.name === 'MulterError') {
    const message = error.message || 'File upload error. Please try again.';
    return res.status(400).json({ message });
  }

  const isTimeout = error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED';
	const isAuthFailure = error.code === '28P01';
  const statusCode = error.statusCode || (isTimeout ? 503 : 500);
	const message = isTimeout
		? 'Supabase Postgres is not reachable from this machine. Use the Supabase pooler/database connection string from the dashboard or check outbound network access.'
		: isAuthFailure
			? 'Supabase Postgres authentication failed. Verify the exact database password in backend/.env.'
			: error.message || 'Internal server error';

  if (env.nodeEnv !== 'production' && !isTimeout) {
		console.error(error);
	}

	res.status(statusCode).json({ message });
});

module.exports = app;
