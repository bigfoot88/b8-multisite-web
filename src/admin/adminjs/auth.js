const { verifyPassword } = require('../../lib/passwords');
const { resolveSessionSecret } = require('../../lib/session');

const ADMINJS_COOKIE_NAME = 'b8_adminjs';

async function authenticateAdmin(identifier, password, adminRepository) {
  const normalizedIdentifier = identifier?.trim();

  if (!normalizedIdentifier || !password || !adminRepository) {
    return null;
  }

  const admin = adminRepository.findByUsername(normalizedIdentifier)
    || adminRepository.findByEmail(normalizedIdentifier);

  if (!admin || !admin.isActive) {
    return null;
  }

  const passwordMatches = await verifyPassword(password, admin.passwordHash);

  if (!passwordMatches) {
    return null;
  }

  return {
    email: admin.email || admin.username,
    title: admin.displayName || admin.username,
  };
}

function buildAdminJsAuth({ adminRepository, sessionSecret } = {}) {
  const cookieSecret = sessionSecret || resolveSessionSecret();

  return {
    authentication: {
      authenticate: (identifier, password) => authenticateAdmin(identifier, password, adminRepository),
      cookieName: ADMINJS_COOKIE_NAME,
      cookiePassword: cookieSecret,
    },
    sessionOptions: {
      resave: false,
      saveUninitialized: false,
      secret: cookieSecret,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
      },
    },
  };
}

module.exports = {
  ADMINJS_COOKIE_NAME,
  authenticateAdmin,
  buildAdminJsAuth,
};
