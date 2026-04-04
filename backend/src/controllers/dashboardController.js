const { getDashboardNote, saveDashboardNote } = require('../services/dashboardNoteService');

const fetchNote = async (req, res, next) => {
  try {
    const adminEmail = req.user?.email;
    const note = await getDashboardNote({ adminEmail });
    res.status(200).json({ note });
  } catch (error) {
    next(error);
  }
};

const updateNote = async (req, res, next) => {
  try {
    const adminEmail = req.user?.email;
    const { content } = req.body || {};
    const note = await saveDashboardNote({ adminEmail, content });
    res.status(200).json({ note });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  fetchNote,
  updateNote,
};