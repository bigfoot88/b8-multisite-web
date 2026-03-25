const bcrypt = require('bcryptjs');

const DEFAULT_PASSWORD_ROUNDS = 10;

function hashPassword(password, rounds = DEFAULT_PASSWORD_ROUNDS) {
  return bcrypt.hash(password, rounds);
}

function verifyPassword(password, passwordHash) {
  if (!password || !passwordHash) {
    return false;
  }

  return bcrypt.compare(password, passwordHash);
}

module.exports = {
  DEFAULT_PASSWORD_ROUNDS,
  hashPassword,
  verifyPassword,
};
