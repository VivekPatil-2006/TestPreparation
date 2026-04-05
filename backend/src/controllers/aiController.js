const { askQuestionDoubt, listAvailableGrokModels } = require('../services/aiService');

const askDoubt = async (req, res, next) => {
  try {
    const { message, questionText, options, selectedAnswer, history } = req.body || {};

    const data = await askQuestionDoubt({
      message,
      questionText,
      options,
      selectedAnswer,
      history,
    });

    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

const getModels = async (req, res, next) => {
  try {
    const data = await listAvailableGrokModels();
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  askDoubt,
  getModels,
};
