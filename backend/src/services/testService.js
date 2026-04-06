const { pool, ensureDbConnection } = require('../config/db');
const { quoteIdent } = require('../utils/dbHelpers');
const { getPublicTables, getTableColumnNames } = require('./analyticsService');

const TEST_SESSION_TABLE = 'test_sessions';
const TEST_SESSION_QUESTIONS_TABLE = 'test_session_questions';
const TEST_SESSION_ANSWERS_TABLE = 'test_session_answers';
const DEFAULT_QUESTION_COUNT = 30;
const DEFAULT_TIMER_PER_QUESTION_MINUTES = 1;
const REQUIRED_OPTION_COLUMNS = ['option1', 'option2', 'option3', 'option4'];

let legacyBackfillComplete = false;

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
      q.source_table AS table_name,
      MAX(q.row_number)::int AS last_row_number
    FROM ${quoteIdent(TEST_SESSION_TABLE)} ts
    INNER JOIN ${quoteIdent(TEST_SESSION_QUESTIONS_TABLE)} q
      ON q.session_id = ts.id
    WHERE ts.admin_email = $1
      AND COALESCE(q.source_table, '') <> ''
    GROUP BY q.source_table;
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
  const options = optionKeys
    .map((key) => row[key])
    .map((value) => (value == null ? '' : String(value).trim()))
    .filter(Boolean);

  const questionText = row.question || row.prompt || row.title;
  const correctAnswer = row.answer;

  if (!isPopulatedValue(questionText) || !isPopulatedValue(correctAnswer)) {
    return null;
  }

  const normalizedCorrectAnswer = String(correctAnswer).trim();
  const hasCorrectAnswerInOptions = options.some(
    (option) => option.toLowerCase() === normalizedCorrectAnswer.toLowerCase()
  );

  if (!hasCorrectAnswerInOptions) {
    options.push(normalizedCorrectAnswer);
  }

  return {
    questionKey: `${sourceTable}:${row.id ?? rowNumber}`,
    sourceTable,
    rowId: row.id,
    rowNumber,
    questionText: String(questionText).trim(),
    options,
    correctAnswer: normalizedCorrectAnswer,
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

  const sessionTableQuery = `
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

  const sessionQuestionsTableQuery = `
    CREATE TABLE IF NOT EXISTS ${quoteIdent(TEST_SESSION_QUESTIONS_TABLE)} (
      id BIGSERIAL PRIMARY KEY,
      session_id BIGINT NOT NULL REFERENCES ${quoteIdent(TEST_SESSION_TABLE)} (id) ON DELETE CASCADE,
      question_order INTEGER NOT NULL,
      question_key TEXT NOT NULL,
      source_table TEXT,
      row_id BIGINT,
      row_number INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      option1 TEXT NOT NULL,
      option2 TEXT NOT NULL,
      option3 TEXT NOT NULL,
      option4 TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (session_id, question_order),
      UNIQUE (session_id, question_key)
    );
  `;

  const sessionAnswersTableQuery = `
    CREATE TABLE IF NOT EXISTS ${quoteIdent(TEST_SESSION_ANSWERS_TABLE)} (
      id BIGSERIAL PRIMARY KEY,
      session_id BIGINT NOT NULL REFERENCES ${quoteIdent(TEST_SESSION_TABLE)} (id) ON DELETE CASCADE,
      question_key TEXT NOT NULL,
      selected_answer TEXT NOT NULL DEFAULT '',
      answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (session_id, question_key)
    );
  `;

  await pool.query(sessionTableQuery);
  await pool.query(sessionQuestionsTableQuery);
  await pool.query(sessionAnswersTableQuery);
  await backfillLegacySessionData();
};

const backfillLegacySessionData = async () => {
  if (legacyBackfillComplete) {
    return;
  }

  const questionsBackfillQuery = `
    INSERT INTO ${quoteIdent(TEST_SESSION_QUESTIONS_TABLE)} (
      session_id,
      question_order,
      question_key,
      source_table,
      row_id,
      row_number,
      question_text,
      option1,
      option2,
      option3,
      option4,
      correct_answer
    )
    SELECT
      ts.id AS session_id,
      elem.ordinality::int AS question_order,
      COALESCE(
        NULLIF(elem.value->>'questionKey', ''),
        CONCAT(
          COALESCE(NULLIF(elem.value->>'sourceTable', ''), ts.table_name),
          ':',
          COALESCE(NULLIF(elem.value->>'rowId', ''), NULLIF(elem.value->>'rowNumber', ''), elem.ordinality::text)
        )
      ) AS question_key,
      COALESCE(NULLIF(elem.value->>'sourceTable', ''), CASE WHEN POSITION(',' IN ts.table_name) = 0 THEN ts.table_name ELSE '' END) AS source_table,
      CASE WHEN COALESCE(elem.value->>'rowId', '') ~ '^[0-9]+$' THEN (elem.value->>'rowId')::bigint ELSE NULL END AS row_id,
      CASE WHEN COALESCE(elem.value->>'rowNumber', '') ~ '^[0-9]+$' THEN (elem.value->>'rowNumber')::int ELSE elem.ordinality::int END AS row_number,
      COALESCE(elem.value->>'questionText', '') AS question_text,
      COALESCE(elem.value->'options'->>0, '') AS option1,
      COALESCE(elem.value->'options'->>1, '') AS option2,
      COALESCE(elem.value->'options'->>2, '') AS option3,
      COALESCE(elem.value->'options'->>3, '') AS option4,
      COALESCE(elem.value->>'correctAnswer', '') AS correct_answer
    FROM ${quoteIdent(TEST_SESSION_TABLE)} ts
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ts.questions, '[]'::jsonb)) WITH ORDINALITY AS elem(value, ordinality)
    LEFT JOIN ${quoteIdent(TEST_SESSION_QUESTIONS_TABLE)} q
      ON q.session_id = ts.id AND q.question_order = elem.ordinality::int
    WHERE q.id IS NULL
      AND COALESCE(elem.value->>'questionText', '') <> '';
  `;

  const answersBackfillQuery = `
    INSERT INTO ${quoteIdent(TEST_SESSION_ANSWERS_TABLE)} (
      session_id,
      question_key,
      selected_answer,
      answered_at
    )
    SELECT
      ts.id AS session_id,
      kv.key AS question_key,
      COALESCE(kv.value, '') AS selected_answer,
      COALESCE(ts.completed_at, ts.started_at, NOW()) AS answered_at
    FROM ${quoteIdent(TEST_SESSION_TABLE)} ts
    CROSS JOIN LATERAL jsonb_each_text(COALESCE(ts.answers, '{}'::jsonb)) AS kv
    LEFT JOIN ${quoteIdent(TEST_SESSION_ANSWERS_TABLE)} a
      ON a.session_id = ts.id AND a.question_key = kv.key
    WHERE a.id IS NULL;
  `;

  await pool.query(questionsBackfillQuery);
  await pool.query(answersBackfillQuery);
  legacyBackfillComplete = true;
};

const toStoredQuestionPayload = (question) => ({
  questionKey: String(question.questionKey || ''),
  sourceTable: String(question.sourceTable || ''),
  rowId: question.rowId == null ? null : Number(question.rowId),
  rowNumber: Number(question.rowNumber) || 0,
  questionText: String(question.questionText || ''),
  options: Array.isArray(question.options) ? question.options.map((option) => String(option == null ? '' : option)) : ['', '', '', ''],
  correctAnswer: String(question.correctAnswer || ''),
});

const insertSessionQuestions = async ({ client, sessionId, questions }) => {
  if (!questions.length) {
    return;
  }

  const values = [];
  const placeholders = questions
    .map((question, index) => {
      const base = index * 12;
      values.push(
        sessionId,
        index + 1,
        question.questionKey,
        question.sourceTable,
        Number.isFinite(Number(question.rowId)) ? Number(question.rowId) : null,
        Number(question.rowNumber) || index + 1,
        question.questionText,
        question.options[0] || '',
        question.options[1] || '',
        question.options[2] || '',
        question.options[3] || '',
        question.correctAnswer
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12})`;
    })
    .join(', ');

  const insertQuery = `
    INSERT INTO ${quoteIdent(TEST_SESSION_QUESTIONS_TABLE)} (
      session_id,
      question_order,
      question_key,
      source_table,
      row_id,
      row_number,
      question_text,
      option1,
      option2,
      option3,
      option4,
      correct_answer
    )
    VALUES ${placeholders};
  `;

  await client.query(insertQuery, values);
};

const fetchSessionQuestions = async ({ sessionId, fallbackSessionRow = null }) => {
  const query = `
    SELECT
      question_key,
      source_table,
      row_id,
      row_number,
      question_text,
      option1,
      option2,
      option3,
      option4,
      correct_answer
    FROM ${quoteIdent(TEST_SESSION_QUESTIONS_TABLE)}
    WHERE session_id = $1
    ORDER BY question_order ASC;
  `;

  const { rows } = await pool.query(query, [sessionId]);
  if (rows.length) {
    return rows.map((row) => ({
      questionKey: row.question_key,
      sourceTable: row.source_table,
      rowId: row.row_id,
      rowNumber: row.row_number,
      questionText: row.question_text,
      options: [row.option1, row.option2, row.option3, row.option4],
      correctAnswer: row.correct_answer,
    }));
  }

  const legacyQuestions = Array.isArray(fallbackSessionRow?.questions) ? fallbackSessionRow.questions : [];
  return legacyQuestions.map((question, index) => ({
    questionKey: question.questionKey || `${question.sourceTable || fallbackSessionRow?.table_name || 'table'}:${question.rowId || question.rowNumber || index + 1}`,
    sourceTable: question.sourceTable || '',
    rowId: question.rowId ?? null,
    rowNumber: Number(question.rowNumber) || index + 1,
    questionText: question.questionText || '',
    options: Array.isArray(question.options) ? question.options : ['', '', '', ''],
    correctAnswer: question.correctAnswer || '',
  }));
};

const normalizeAnswersInput = (answers) => {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return {};
  }

  return Object.entries(answers).reduce((accumulator, [key, value]) => {
    const answerKey = String(key || '').trim();
    if (!answerKey) {
      return accumulator;
    }

    accumulator[answerKey] = String(value == null ? '' : value).trim();
    return accumulator;
  }, {});
};

const saveSessionAnswers = async ({ client, sessionId, answersMap }) => {
  await client.query(`DELETE FROM ${quoteIdent(TEST_SESSION_ANSWERS_TABLE)} WHERE session_id = $1`, [sessionId]);

  const entries = Object.entries(answersMap);
  if (!entries.length) {
    return;
  }

  const values = [];
  const placeholders = entries
    .map(([questionKey, selectedAnswer], index) => {
      const base = index * 4;
      values.push(sessionId, questionKey, selectedAnswer, new Date().toISOString());
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
    })
    .join(', ');

  const query = `
    INSERT INTO ${quoteIdent(TEST_SESSION_ANSWERS_TABLE)} (
      session_id,
      question_key,
      selected_answer,
      answered_at
    )
    VALUES ${placeholders}
    ON CONFLICT (session_id, question_key)
    DO UPDATE SET
      selected_answer = EXCLUDED.selected_answer,
      answered_at = EXCLUDED.answered_at;
  `;

  await client.query(query, values);
};

const getStoredAnswersMap = async ({ sessionId, fallbackSessionRow = null }) => {
  const query = `
    SELECT question_key, selected_answer
    FROM ${quoteIdent(TEST_SESSION_ANSWERS_TABLE)}
    WHERE session_id = $1;
  `;

  const { rows } = await pool.query(query, [sessionId]);
  if (rows.length) {
    return rows.reduce((accumulator, row) => {
      accumulator[String(row.question_key)] = String(row.selected_answer || '');
      return accumulator;
    }, {});
  }

  const legacyAnswers = fallbackSessionRow?.answers;
  return legacyAnswers && typeof legacyAnswers === 'object' && !Array.isArray(legacyAnswers) ? legacyAnswers : {};
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

const buildDetailedResults = ({ storedQuestions = [], answers = {}, consideredCount }) => {
  const safeCount = Math.min(
    Math.max(Number(consideredCount) || storedQuestions.length, 1),
    storedQuestions.length
  );
  const scoredQuestions = storedQuestions.slice(0, safeCount);
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

  return {
    obtainedMarks,
    consideredCount: safeCount,
    detailedResults,
  };
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
  const storedQuestions = selectedQuestions.map(toStoredQuestionPayload);

  const client = await pool.connect();
  let session;

  try {
    await client.query('BEGIN');

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

    const { rows } = await client.query(insertQuery, [
      adminEmail,
      requestedTables.join(', '),
      safeStartRow,
      endRow,
      selectedQuestions.length,
      durationMinutes,
      selectedQuestions.length,
      JSON.stringify(storedQuestions),
    ]);

    session = rows[0];
    await insertSessionQuestions({ client, sessionId: session.id, questions: storedQuestions });
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

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

  const storedQuestions = await fetchSessionQuestions({ sessionId: session.id, fallbackSessionRow: session });
  const normalizedAnswersMap = normalizeAnswersInput(answers);
  const { obtainedMarks, consideredCount: safeConsideredCount, detailedResults } = buildDetailedResults({
    storedQuestions,
    answers: normalizedAnswersMap,
    consideredCount: consideredQuestionCount,
  });

  const client = await pool.connect();
  let updatedSession;

  try {
    await client.query('BEGIN');

    await saveSessionAnswers({ client, sessionId: session.id, answersMap: normalizedAnswersMap });

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

    const { rows: updatedRows } = await client.query(updateQuery, [
      JSON.stringify(normalizedAnswersMap),
      obtainedMarks,
      safeConsideredCount,
      safeConsideredCount,
      session.id,
      adminEmail,
    ]);

    updatedSession = updatedRows[0];
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

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

const getTestSessionDetails = async ({ sessionId, adminEmail }) => {
  ensureDbConnection();
  await ensureTestSessionTable();

  const safeSessionId = Number(sessionId);
  if (!Number.isFinite(safeSessionId) || safeSessionId < 1) {
    const error = new Error('A valid session id is required.');
    error.statusCode = 400;
    throw error;
  }

  const query = `
    SELECT *
    FROM ${quoteIdent(TEST_SESSION_TABLE)}
    WHERE id = $1 AND admin_email = $2
    LIMIT 1;
  `;

  const { rows } = await pool.query(query, [safeSessionId, adminEmail]);
  const session = rows[0];

  if (!session) {
    const error = new Error('Test session not found.');
    error.statusCode = 404;
    throw error;
  }

  const storedQuestions = await fetchSessionQuestions({ sessionId: session.id, fallbackSessionRow: session });
  const storedAnswers = await getStoredAnswersMap({ sessionId: session.id, fallbackSessionRow: session });
  const { obtainedMarks, consideredCount, detailedResults } = buildDetailedResults({
    storedQuestions,
    answers: storedAnswers,
    consideredCount: session.question_count,
  });

  return {
    sessionId: session.id,
    tableName: session.table_name,
    startRow: session.start_row,
    endRow: session.end_row,
    questionCount: consideredCount,
    durationMinutes: session.duration_minutes,
    totalMarks: consideredCount,
    obtainedMarks,
    percentageScore: consideredCount ? Math.round((obtainedMarks / consideredCount) * 100) : 0,
    status: session.status,
    startedAt: session.started_at,
    completedAt: session.completed_at,
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
  getTestSessionDetails,
  updateQuestionRow,
};
