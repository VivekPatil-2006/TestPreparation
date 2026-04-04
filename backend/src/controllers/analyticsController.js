const { getAnalyticsSnapshot, getSubmissionMonthSnapshot } = require('../services/analyticsService');

const getAnalytics = async (req, res, next) => {
  try {
    const analytics = await getAnalyticsSnapshot();
    res.status(200).json(analytics);
  } catch (error) {
    next(error);
  }
};

const getSubmissionMonth = async (req, res, next) => {
  try {
    const month = req.query.month;
    const year = req.query.year;
    const submissionMonth = await getSubmissionMonthSnapshot({ month, year });
    res.status(200).json({ submissionMonth });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAnalytics,
  getSubmissionMonth,
};
