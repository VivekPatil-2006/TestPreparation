const { askQuestionDoubt } = require('../services/aiService');

const askDoubt = async (req, res, next) => {
  try {
    const { message, model, questionText, options, selectedAnswer, history } = req.body || {};

    const data = await askQuestionDoubt({
      message,
      model,
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

module.exports = {
  askDoubt,
};
