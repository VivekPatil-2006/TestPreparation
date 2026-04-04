const { validateAdminLogin } = require('../services/authService');

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const result = await validateAdminLogin(email, password);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
};
