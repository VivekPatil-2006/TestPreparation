const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const validateAdminLogin = async (email, password) => {
  if (!env.adminPasswordHash || !env.jwtSecret) {
    const error = new Error('ADMIN_PASSWORD_HASH or JWT_SECRET is not configured in backend/.env');
    error.statusCode = 500;
    throw error;
  }

  const isEmailValid = String(email || '').toLowerCase() === String(env.adminEmail).toLowerCase();
  const isPasswordValid = await bcrypt.compare(String(password || ''), env.adminPasswordHash);

  if (!isEmailValid || !isPasswordValid) {
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    throw error;
  }

  const token = jwt.sign(
    {
      role: 'admin',
      email: env.adminEmail,
    },
    env.jwtSecret,
    { expiresIn: '12h' }
  );

  return {
    token,
    user: {
      email: env.adminEmail,
      role: 'admin',
    },
  };
};

module.exports = {
  validateAdminLogin,
};
