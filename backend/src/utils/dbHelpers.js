const crypto = require('crypto');

const sanitizeTableName = (fileName) => {
  const base = fileName.replace(/\.csv$/i, '');
  const sanitized = base
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!sanitized) {
    throw new Error('Invalid CSV file name. Unable to derive table name.');
  }

  return sanitized;
};

const sanitizeColumnName = (columnName) => {
  const sanitized = String(columnName)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return sanitized || 'column_value';
};

const quoteIdent = (identifier) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
};

const stableRowHash = (rowObject) => {
  const orderedKeys = Object.keys(rowObject).sort();
  const normalized = {};

  for (const key of orderedKeys) {
    const value = rowObject[key];
    normalized[key] = value == null ? '' : String(value).trim();
  }

  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
};

module.exports = {
  sanitizeTableName,
  sanitizeColumnName,
  quoteIdent,
  stableRowHash,
};
