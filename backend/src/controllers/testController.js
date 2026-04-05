const {
  getTestTables,
  getLastQuestionByTable,
  startTestSession,
  completeTestSession,
  getTestHistory,
  updateQuestionRow,
} = require('../services/testService');

const listTables = async (req, res, next) => {
  try {
    const adminEmail = req.user?.email;
    const tables = await getTestTables();
    const lastQuestionByTable = await getLastQuestionByTable(adminEmail);
    res.status(200).json({ tables, lastQuestionByTable });
  } catch (error) {
    next(error);
  }
};

const startTest = async (req, res, next) => {
  try {
    const { tableName, tableNames, startRow, startRowsByTable, questionCount, timerMode, customMinutes } = req.body || {};
    const adminEmail = req.user?.email;
    const data = await startTestSession({
      adminEmail,
      tableName,
      tableNames,
      startRow,
      startRowsByTable,
      questionCount,
      timerMode,
      customMinutes,
    });
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

const submitTest = async (req, res, next) => {
  try {
    const { sessionId, answers, consideredQuestionCount } = req.body || {};
    const adminEmail = req.user?.email;
    const data = await completeTestSession({
      sessionId,
      adminEmail,
      answers,
      consideredQuestionCount,
    });
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

const history = async (req, res, next) => {
  try {
    const adminEmail = req.user?.email;
    const limit = req.query.limit;
    const data = await getTestHistory({ adminEmail, limit });
    res.status(200).json({ history: data });
  } catch (error) {
    next(error);
  }
};

const updateQuestion = async (req, res, next) => {
  try {
    const { tableName, rowId, questionText, options } = req.body || {};
    const data = await updateQuestionRow({
      tableName,
      rowId,
      questionText,
      options,
    });
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listTables,
  startTest,
  submitTest,
  history,
  updateQuestion,
};
