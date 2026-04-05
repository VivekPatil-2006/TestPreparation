const { pool, ensureDbConnection } = require('../config/db');
const env = require('../config/env');
const { quoteIdent } = require('../utils/dbHelpers');
const { getPublicTables, getTableColumnNames } = require('./analyticsService');

const TEST_SESSION_TABLE = 'test_sessions';
const DEFAULT_QUESTION_COUNT = 30;
const DEFAULT_TIMER_PER_QUESTION_MINUTES = 1;
const REQUIRED_OPTION_COLUMNS = ['option1', 'option2', 'option3', 'option4'];

const getTestTables = async () => {
  const tables = await getPublicTables();
  const filteredTables = tables.filter((tableName) => String(tableName).toLowerCase() !== TEST_SESSION_TABLE);

  if (!filteredTables.length) {
    return [];
  }

  const columnsByTable = await Promise.all(
    filteredTables.map(async (tableName) => {
      const columns = await getTableColumnNames(tableName);
      return { tableName, columns };
    })
  );

  return columnsByTable
    .filter(({ columns }) => {
      const columnSet = new Set(columns.map((name) => String(name).toLowerCase()));
      const hasAnswer = columnSet.has('answer');
      const hasQuestionField = columnSet.has('question') || columnSet.has('prompt') || columnSet.has('title');
      const hasAllOptions = REQUIRED_OPTION_COLUMNS.every((optionKey) => columnSet.has(optionKey));
      return hasAnswer && hasQuestionField && hasAllOptions;
    })
    .map(({ tableName }) => tableName);
};

const getLastQuestionByTable = async (adminEmail) => {
  ensureDbConnection();
  await ensureTestSessionTable();

  if (!adminEmail) {
    return {};
  }

  const query = `
    SELECT
      COALESCE(
        NULLIF(elem->>'sourceTable', ''),
        CASE WHEN POSITION(',' IN ts.table_name) = 0 THEN ts.table_name ELSE NULL END
      ) AS table_name,
      MAX((elem->>'rowNumber')::int) AS last_row_number
    FROM ${quoteIdent(TEST_SESSION_TABLE)} ts
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ts.questions, '[]'::jsonb)) elem
    WHERE ts.admin_email = $1
      AND (elem ? 'rowNumber')
    GROUP BY 1;
  `;

  const { rows } = await pool.query(query, [adminEmail]);

  return rows.reduce((accumulator, row) => {
    const tableName = row.table_name;
    if (!tableName || String(tableName).toLowerCase() === TEST_SESSION_TABLE) {
      return accumulator;
    }

    accumulator[tableName] = Number(row.last_row_number) || 0;
    return accumulator;
  }, {});
};

const isPopulatedValue = (value) => value != null && String(value).trim() !== '';

const normalizeQuestionRow = (row, rowNumber, sourceTable) => {
  const optionKeys = ['option1', 'option2', 'option3', 'option4'];
  const options = optionKeys.map((key) => row[key]).map((value) => (value == null ? '' : String(value).trim()));

  if (options.some((option) => !option)) {
    return null;
  }

  const questionText = row.question || row.prompt || row.title;
  const correctAnswer = row.answer;

  if (!isPopulatedValue(questionText) || !isPopulatedValue(correctAnswer)) {
    return null;
  }

  return {
    questionKey: `${sourceTable}:${row.id ?? rowNumber}`,
    sourceTable,
    rowId: row.id,
    rowNumber,
    questionText: String(questionText).trim(),
    options,
    correctAnswer: String(correctAnswer).trim(),
  };
};

const pickQuestionTextColumn = (columns) => {
  const columnSet = new Set(columns.map((name) => String(name).toLowerCase()));
  if (columnSet.has('question')) return 'question';
  if (columnSet.has('prompt')) return 'prompt';
  if (columnSet.has('title')) return 'title';
  return null;
};

const pickOptionColumns = (columns) => {
  const optionSets = [
    ['option1', 'option2', 'option3', 'option4'],
    ['option_a', 'option_b', 'option_c', 'option_d'],
  ];

  const columnSet = new Set(columns.map((name) => String(name).toLowerCase()));
  return optionSets.find((candidate) => candidate.every((column) => columnSet.has(column))) || [];
};

const updateQuestionRow = async ({ tableName, rowId, questionText, options = [] }) => {
  ensureDbConnection();

  const safeTableName = String(tableName || '').trim();
  const safeRowId = Number(rowId);

  if (!safeTableName) {
    const error = new Error('Table name is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isFinite(safeRowId) || safeRowId < 1) {
    const error = new Error('A valid row id is required.');
    error.statusCode = 400;
    throw error;
  }

  const columns = await getTableColumnNames(safeTableName);
  const textColumn = pickQuestionTextColumn(columns);
  const optionColumns = pickOptionColumns(columns);

  if (!textColumn) {
    const error = new Error('Unable to find a question text column in the selected table.');
    error.statusCode = 400;
    throw error;
  }

  if (optionColumns.length !== 4) {
    const error = new Error('Unable to find four option columns in the selected table.');
    error.statusCode = 400;
    throw error;
  }

  const nextOptions = Array.isArray(options) ? options.map((option) => String(option == null ? '' : option).trim()) : [];
  if (nextOptions.length !== 4 || nextOptions.some((option) => !option)) {
    const error = new Error('Four non-empty options are required.');
    error.statusCode = 400;
    throw error;
  }

  const nextQuestionText = String(questionText == null ? '' : questionText).trim();
  if (!nextQuestionText) {
    const error = new Error('Question text is required.');
    error.statusCode = 400;
    throw error;
  }

  const assignments = [
    `${quoteIdent(textColumn)} = $1`,
    ...optionColumns.map((column, index) => `${quoteIdent(column)} = $${index + 2}`),
  ].join(', ');

  const query = `
    UPDATE ${quoteIdent(safeTableName)}
    SET ${assignments}
    WHERE id = $6
    RETURNING id;
  `;

  const { rows } = await pool.query(query, [
    nextQuestionText,
    nextOptions[0],
    nextOptions[1],
    nextOptions[2],
    nextOptions[3],
    safeRowId,
  ]);

  if (!rows.length) {
    const error = new Error('Question row not found.');
    error.statusCode = 404;
    throw error;
  }

  return {
    tableName: safeTableName,
    rowId: safeRowId,
    questionText: nextQuestionText,
    options: nextOptions,
  };
};

const fetchValidQuestions = async (tableName) => {
  const query = `
    SELECT *
    FROM ${quoteIdent(tableName)}
    ORDER BY id ASC;
  `;

  const { rows } = await pool.query(query);

  return rows
    .map((row, index) => normalizeQuestionRow(row, index + 1, tableName))
    .filter(Boolean);
};

const normalizeRequestedTables = (tableName, tableNames) => {
  if (Array.isArray(tableNames) && tableNames.length) {
    return [...new Set(tableNames.map((item) => String(item || '').trim()).filter(Boolean))];
  }

  if (String(tableName || '').trim()) {
    return [String(tableName).trim()];
  }

  return [];
};

const ensureTestSessionTable = async () => {
  ensureDbConnection();

  const query = `
    CREATE TABLE IF NOT EXISTS ${quoteIdent(TEST_SESSION_TABLE)} (
      id BIGSERIAL PRIMARY KEY,
      admin_email TEXT NOT NULL,
      table_name TEXT NOT NULL,
      start_row INTEGER NOT NULL,
      end_row INTEGER NOT NULL,
      question_count INTEGER NOT NULL,
      duration_minutes INTEGER NOT NULL,
      total_marks INTEGER NOT NULL,
      obtained_marks INTEGER,
      answers JSONB DEFAULT '{}'::jsonb,
      questions JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'in_progress',
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );
  `;

  await pool.query(query);
};

const deriveDurationMinutes = (questionCount, timerMode, customMinutes) => {
  if (timerMode === 'custom') {
    const parsedCustomMinutes = Number(customMinutes);
    return Number.isFinite(parsedCustomMinutes) && parsedCustomMinutes > 0
      ? Math.round(parsedCustomMinutes)
      : DEFAULT_QUESTION_COUNT * DEFAULT_TIMER_PER_QUESTION_MINUTES;
  }

  const safeQuestionCount = Number.isFinite(questionCount) ? Math.max(questionCount, 1) : DEFAULT_QUESTION_COUNT;
  return safeQuestionCount * DEFAULT_TIMER_PER_QUESTION_MINUTES;
};

const buildPerTableStartRows = (requestedTables, startRowsByTable, fallbackStartRow) => {
  const safeMap = {};
  requestedTables.forEach((tableName) => {
    const rawValue = startRowsByTable?.[tableName];
    safeMap[tableName] = Math.max(Number(rawValue) || fallbackStartRow, 1);
  });
  return safeMap;
};

const buildCombinedQuestions = (requestedTables, questionBatches, startRows) => {
  const pools = requestedTables.map((tableName, index) => {
    const startRow = startRows[tableName] || 1;
    const questions = (questionBatches[index] || []).slice(startRow - 1);
    return {
      tableName,
      startRow,
      questions,
    };
  });

  return pools;
};

const pickQuestionsRoundRobin = (questionPools, maxCount) => {
  const selected = [];
  let cursor = 0;

  while (selected.length < maxCount) {
    let addedInThisRound = false;

    for (const pool of questionPools) {
      const question = pool.questions[cursor];
      if (!question) {
        continue;
      }

      selected.push(question);
      addedInThisRound = true;
      if (selected.length >= maxCount) {
        break;
      }
    }

    if (!addedInThisRound) {
      break;
    }

    cursor += 1;
  }

  return selected;
};

const startTestSession = async ({ adminEmail, tableName, tableNames = [], startRow = 1, startRowsByTable = {}, questionCount = DEFAULT_QUESTION_COUNT, timerMode = 'per_question', customMinutes }) => {
  ensureDbConnection();
  await ensureTestSessionTable();

  const availableTables = await getPublicTables();
  const requestedTables = normalizeRequestedTables(tableName, tableNames);

  if (!requestedTables.length) {
    const error = new Error('At least one table must be selected.');
    error.statusCode = 400;
    throw error;
  }

  const invalidTables = requestedTables.filter((name) => !availableTables.includes(name));
  if (invalidTables.length) {
    const error = new Error(`Requested table does not exist: ${invalidTables.join(', ')}`);
    error.statusCode = 404;
    throw error;
  }

  const safeStartRow = Math.max(Number(startRow) || 1, 1);
  const safeQuestionCount = Math.max(Number(questionCount) || DEFAULT_QUESTION_COUNT, 1);
  const tableStartRows = buildPerTableStartRows(requestedTables, startRowsByTable, safeStartRow);

  const questionBatches = await Promise.all(requestedTables.map((name) => fetchValidQuestions(name)));
  const questionPools = buildCombinedQuestions(requestedTables, questionBatches, tableStartRows);
  const selectedQuestions = pickQuestionsRoundRobin(questionPools, safeQuestionCount);
  const endRow = safeStartRow + selectedQuestions.length;

  if (!selectedQuestions.length) {
    const error = new Error('No eligible questions found for the selected row range.');
    error.statusCode = 404;
    throw error;
  }

  const durationMinutes = deriveDurationMinutes(selectedQuestions.length, timerMode, customMinutes);
  const storedQuestions = selectedQuestions;

  const insertQuery = `
    INSERT INTO ${quoteIdent(TEST_SESSION_TABLE)} (
      admin_email,
      table_name,
      start_row,
      end_row,
      question_count,
      duration_minutes,
      total_marks,
      questions,
      status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'in_progress')
    RETURNING *;
  `;

  const { rows } = await pool.query(insertQuery, [
    adminEmail,
    requestedTables.join(', '),
    safeStartRow,
    endRow,
    selectedQuestions.length,
    durationMinutes,
    selectedQuestions.length,
    JSON.stringify(storedQuestions),
  ]);

  const session = rows[0];

  return {
    sessionId: session.id,
    tableName: requestedTables.join(', '),
    tableNames: requestedTables,
    startRowsByTable: tableStartRows,
    startRow: safeStartRow,
    endRow,
    questionCount: selectedQuestions.length,
    durationMinutes,
    totalMarks: selectedQuestions.length,
    questions: selectedQuestions.map(({ correctAnswer, ...question }) => question),
  };
};

const completeTestSession = async ({ sessionId, adminEmail, answers = {}, consideredQuestionCount }) => {
  ensureDbConnection();
  await ensureTestSessionTable();

  const selectQuery = `
    SELECT *
    FROM ${quoteIdent(TEST_SESSION_TABLE)}
    WHERE id = $1 AND admin_email = $2
    LIMIT 1;
  `;

  const { rows } = await pool.query(selectQuery, [sessionId, adminEmail]);
  const session = rows[0];

  if (!session) {
    const error = new Error('Test session not found.');
    error.statusCode = 404;
    throw error;
  }

  const storedQuestions = Array.isArray(session.questions) ? session.questions : [];
  const safeConsideredCount = Math.min(
    Math.max(Number(consideredQuestionCount) || storedQuestions.length, 1),
    storedQuestions.length
  );
  const scoredQuestions = storedQuestions.slice(0, safeConsideredCount);
  let obtainedMarks = 0;

  const detailedResults = scoredQuestions.map((question) => {
    const selectedAnswer = answers[String(question.questionKey)] ?? answers[String(question.rowId)] ?? answers[question.rowId] ?? '';
    const normalizedSelected = String(selectedAnswer).trim().toLowerCase();
    const normalizedCorrect = String(question.correctAnswer || '').trim().toLowerCase();
    const isCorrect = normalizedSelected === normalizedCorrect;

    const options = Array.isArray(question.options)
      ? question.options.map((option) => String(option == null ? '' : option).trim())
      : [];
    const selectedOptionIndex = options.findIndex((option) => option.toLowerCase() === normalizedSelected);
    const correctOptionIndex = options.findIndex((option) => option.toLowerCase() === normalizedCorrect);

    if (isCorrect) {
      obtainedMarks += 1;
    }

    return {
      rowId: question.rowId,
      questionKey: question.questionKey,
      sourceTable: question.sourceTable,
      rowNumber: question.rowNumber,
      questionText: question.questionText || '',
      options,
      selectedAnswer: String(selectedAnswer || ''),
      correctAnswer: question.correctAnswer,
      selectedOptionIndex,
      correctOptionIndex,
      isCorrect,
    };
  });

  const updateQuery = `
    UPDATE ${quoteIdent(TEST_SESSION_TABLE)}
    SET
      status = 'completed',
      answers = $1::jsonb,
      obtained_marks = $2,
      total_marks = $3,
      question_count = $4,
      completed_at = NOW()
    WHERE id = $5 AND admin_email = $6
    RETURNING *;
  `;

  const updatedAnswers = answers || {};
  const { rows: updatedRows } = await pool.query(updateQuery, [
    JSON.stringify(updatedAnswers),
    obtainedMarks,
    safeConsideredCount,
    safeConsideredCount,
    sessionId,
    adminEmail,
  ]);

  const updatedSession = updatedRows[0];

  return {
    sessionId: updatedSession.id,
    tableName: updatedSession.table_name,
    startRow: updatedSession.start_row,
    endRow: updatedSession.end_row,
    questionCount: updatedSession.question_count,
    durationMinutes: updatedSession.duration_minutes,
    totalMarks: updatedSession.total_marks,
    obtainedMarks,
    percentageScore: updatedSession.total_marks ? Math.round((obtainedMarks / updatedSession.total_marks) * 100) : 0,
    detailedResults,
  };
};

const getTestHistory = async ({ adminEmail, limit = 10 }) => {
  ensureDbConnection();
  await ensureTestSessionTable();

  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const query = `
    SELECT
      id,
      table_name,
      start_row,
      end_row,
      question_count,
      duration_minutes,
      total_marks,
      obtained_marks,
      status,
      started_at,
      completed_at
    FROM ${quoteIdent(TEST_SESSION_TABLE)}
    WHERE admin_email = $1
    ORDER BY started_at DESC
    LIMIT $2;
  `;

  const { rows } = await pool.query(query, [adminEmail, safeLimit]);

  return rows.map((row) => ({
    sessionId: row.id,
    tableName: row.table_name,
    startRow: row.start_row,
    endRow: row.end_row,
    questionCount: row.question_count,
    durationMinutes: row.duration_minutes,
    totalMarks: row.total_marks,
    obtainedMarks: row.obtained_marks,
    percentageScore: row.total_marks && row.obtained_marks != null
      ? Math.round((row.obtained_marks / row.total_marks) * 100)
      : null,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  }));
};

module.exports = {
  getTestTables,
  getLastQuestionByTable,
  startTestSession,
  completeTestSession,
  getTestHistory,
  updateQuestionRow,
};
