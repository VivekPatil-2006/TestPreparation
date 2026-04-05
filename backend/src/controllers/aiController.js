const { askQuestionDoubt } = require('../services/aiService');

const askDoubt = async (req, res, next) => {
  try {
    const { message, questionText, options, selectedAnswer, history, provider, model } = req.body || {};

    const data = await askQuestionDoubt({
      message,
      questionText,
      options,
      selectedAnswer,
      history,
      provider,
      model,
    });

    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  askDoubt,
};
