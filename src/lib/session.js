const crypto = require('node:crypto');

const ADMIN_COOKIE_NAME = 'b8_admin';
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  signed: true,
  path: '/',
};

function resolveSessionSecret() {
  if (process.env.ADMIN_SESSION_SECRET) {
    return process.env.ADMIN_SESSION_SECRET;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_SESSION_SECRET must be set in production');
  }

  return crypto.randomBytes(32).toString('hex');
}

function buildAdminSession(admin) {
  return {
    id: admin.id,
    username: admin.username,
    displayName: admin.displayName,
    role: admin.role,
  };
}

function writeAdminSession(res, admin) {
  res.cookie(ADMIN_COOKIE_NAME, buildAdminSession(admin), COOKIE_OPTIONS);
}

function clearAdminSession(res) {
  res.clearCookie(ADMIN_COOKIE_NAME, COOKIE_OPTIONS);
}

function readAdminSession(req) {
  const session = req.signedCookies?.[ADMIN_COOKIE_NAME];

  if (!session || typeof session !== 'object') {
    return null;
  }

  if (!session.id || !session.username) {
    return null;
  }

  return session;
}

function requireAdmin(req, res, next) {
  const adminSession = readAdminSession(req);

  if (!adminSession) {
    return res.redirect('/admin/login');
  }

  const adminRepository = req.app?.locals?.adminRepository;
  const admin = adminRepository?.findById ? adminRepository.findById(adminSession.id) : null;

  if (!admin || !admin.isActive) {
    clearAdminSession(res);
    return res.redirect('/admin/login');
  }

  req.adminSession = buildAdminSession(admin);
  return next();
}

module.exports = {
  ADMIN_COOKIE_NAME,
  COOKIE_OPTIONS,
  buildAdminSession,
  clearAdminSession,
  readAdminSession,
  requireAdmin,
  resolveSessionSecret,
  writeAdminSession,
};
