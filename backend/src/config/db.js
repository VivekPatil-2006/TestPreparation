const { Pool } = require('pg');
const dns = require('dns');
const env = require('./env');

let pool = null;

if (env.supabaseDbUrl) {
  const databaseUrl = new URL(env.supabaseDbUrl);
  const forceIpv4 = String(process.env.DB_FORCE_IPV4 || '').toLowerCase() === 'true';

  dns.setDefaultResultOrder('ipv4first');

  const poolConfig = {
    host: databaseUrl.hostname,
    port: Number(databaseUrl.port || 5432),
    user: decodeURIComponent(databaseUrl.username),
    password: decodeURIComponent(databaseUrl.password),
    database: databaseUrl.pathname.replace(/^\//, '') || 'postgres',
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    ssl: {
      rejectUnauthorized: false,
    },
  };

  if (forceIpv4) {
    poolConfig.family = 4;
    poolConfig.lookup = (hostname, options, callback) => {
      dns.lookup(hostname, { ...options, family: 4, all: false }, callback);
    };
  }

  pool = new Pool(poolConfig);
}

const ensureDbConnection = () => {
  if (!pool) {
    const error = new Error('SUPABASE_DB_URL is missing. Set it in backend/.env to enable SQL table creation and analytics.');
    error.statusCode = 500;
    throw error;
  }
};

module.exports = {
  pool,
  ensureDbConnection,
};
