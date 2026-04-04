const { parse } = require('csv-parse/sync');
const { pool, ensureDbConnection } = require('../config/db');
const {
  sanitizeTableName,
  sanitizeColumnName,
  quoteIdent,
  stableRowHash,
} = require('../utils/dbHelpers');

const createTableIfMissing = async (tableName, columns) => {
  const columnsSql = columns.map((column) => `${quoteIdent(column)} TEXT`).join(', ');
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS ${quoteIdent(tableName)} (
        id BIGSERIAL PRIMARY KEY,
        ${columnsSql},
        row_hash TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    await pool.query(query);
  } catch (error) {
    error.statusCode = error.statusCode || 503;
    error.message = 'Unable to connect to Supabase Postgres while creating the table.';
    throw error;
  }
};

const insertRowsSkippingDuplicates = async (tableName, columns, rows, onProgress) => {
  let insertedCount = 0;
  const totalRows = rows.length;
  const progressStep = 25;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowHash = stableRowHash(row);
    const valueColumns = [...columns, 'row_hash'];
    const placeholders = valueColumns.map((_, index) => `$${index + 1}`).join(', ');
    const values = [...columns.map((column) => row[column]), rowHash];

    const query = `
      INSERT INTO ${quoteIdent(tableName)} (${valueColumns.map(quoteIdent).join(', ')})
      VALUES (${placeholders})
      ON CONFLICT (row_hash) DO NOTHING;
    `;

    try {
      const result = await pool.query(query, values);
      insertedCount += result.rowCount;

      if (onProgress) {
        const scannedCount = index + 1;
        const shouldNotify =
          scannedCount === totalRows ||
          scannedCount === 1 ||
          scannedCount % progressStep === 0;

        if (shouldNotify) {
          onProgress({
            scannedCount,
            totalRows,
            insertedCount,
          });
        }
      }
    } catch (error) {
      error.statusCode = error.statusCode || 503;
      error.message = 'Unable to connect to Supabase Postgres while inserting CSV rows.';
      throw error;
    }
  }

  return insertedCount;
};

const processCsvUpload = async (fileName, fileBuffer, onProgress) => {
  ensureDbConnection();

  const tableName = sanitizeTableName(fileName);
  const csvContent = fileBuffer.toString('utf-8');

  const parsedRows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });

  if (!parsedRows.length) {
    const error = new Error('CSV has no rows to upload.');
    error.statusCode = 400;
    throw error;
  }

  const rawHeaders = Object.keys(parsedRows[0]);
  const uniqueColumns = [];
  const columnTracker = new Set();

  for (const header of rawHeaders) {
    const safe = sanitizeColumnName(header);
    if (!columnTracker.has(safe) && !['id', 'created_at', 'row_hash'].includes(safe)) {
      uniqueColumns.push(safe);
      columnTracker.add(safe);
    }
  }

  if (!uniqueColumns.length) {
    const error = new Error('CSV headers are invalid after sanitization.');
    error.statusCode = 400;
    throw error;
  }

  const normalizedRows = parsedRows.map((row) => {
    const normalized = {};
    rawHeaders.forEach((header) => {
      const safe = sanitizeColumnName(header);
      if (uniqueColumns.includes(safe)) {
        normalized[safe] = row[header] == null ? '' : String(row[header]).trim();
      }
    });
    return normalized;
  });

  await createTableIfMissing(tableName, uniqueColumns);
  if (onProgress) {
    onProgress({
      scannedCount: 0,
      totalRows: normalizedRows.length,
      insertedCount: 0,
    });
  }

  const insertedCount = await insertRowsSkippingDuplicates(
    tableName,
    uniqueColumns,
    normalizedRows,
    onProgress
  );

  return {
    tableName,
    totalRowsInCsv: normalizedRows.length,
    insertedCount,
    skippedDuplicates: normalizedRows.length - insertedCount,
  };
};

module.exports = {
  processCsvUpload,
};
