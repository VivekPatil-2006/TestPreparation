const { pool, ensureDbConnection } = require('../config/db');
const { quoteIdent } = require('../utils/dbHelpers');

const DASHBOARD_NOTES_TABLE = 'dashboard_notes';

const ensureDashboardNotesTable = async () => {
  ensureDbConnection();

  const query = `
    CREATE TABLE IF NOT EXISTS ${quoteIdent(DASHBOARD_NOTES_TABLE)} (
      id BIGSERIAL PRIMARY KEY,
      admin_email TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await pool.query(query);
};

const getDashboardNote = async ({ adminEmail }) => {
  ensureDbConnection();
  await ensureDashboardNotesTable();

  if (!adminEmail) {
    return { content: '', updatedAt: null };
  }

  const query = `
    SELECT content, updated_at
    FROM ${quoteIdent(DASHBOARD_NOTES_TABLE)}
    WHERE admin_email = $1
    LIMIT 1;
  `;

  const { rows } = await pool.query(query, [adminEmail]);
  const note = rows[0];

  return {
    content: note?.content || '',
    updatedAt: note?.updated_at || null,
  };
};

const saveDashboardNote = async ({ adminEmail, content = '' }) => {
  ensureDbConnection();
  await ensureDashboardNotesTable();

  if (!adminEmail) {
    const error = new Error('Admin email is required to save dashboard notes.');
    error.statusCode = 400;
    throw error;
  }

  const safeContent = String(content == null ? '' : content);
  const query = `
    INSERT INTO ${quoteIdent(DASHBOARD_NOTES_TABLE)} (admin_email, content, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (admin_email)
    DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()
    RETURNING content, updated_at;
  `;

  const { rows } = await pool.query(query, [adminEmail, safeContent]);
  const note = rows[0] || {};

  return {
    content: note.content || '',
    updatedAt: note.updated_at || null,
  };
};

module.exports = {
  getDashboardNote,
  saveDashboardNote,
};