const dotenv = require('dotenv');

dotenv.config();

const normalizeOrigin = (value) => String(value || '').trim().replace(/\/+$/, '');

const explicitOrigins = String(process.env.FRONTEND_URLS || '')
  .split(',')
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);

const primaryFrontendOrigin = normalizeOrigin(process.env.FRONTEND_URL || 'http://localhost:3000');
const frontendOrigins = Array.from(new Set([primaryFrontendOrigin, ...explicitOrigins]));

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  frontendUrl: primaryFrontendOrigin,
  frontendOrigins,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseDbUrl: process.env.SUPABASE_DB_URL,
  jwtSecret: process.env.JWT_SECRET,
  geminiApiKey: process.env.GEMINI_API_KEY,
  adminEmail: process.env.ADMIN_EMAIL || 'admin@gmail.com',
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH,
  testDurationMinutes: Number(process.env.TEST_DURATION_MINUTES || 30),
};

module.exports = env;
