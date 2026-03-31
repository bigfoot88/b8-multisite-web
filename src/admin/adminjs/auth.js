const { verifyPassword } = require('../../lib/passwords');
const { resolveSessionSecret } = require('../../lib/session');

const ADMINJS_COOKIE_NAME = 'b8_adminjs';
const ADMINJS_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
};

async function authenticate(identifier, password, adminRepository) {
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

function findAdminForAdminJsSession(adminUser, adminRepository) {
  if (!adminUser || !adminRepository) {
    return null;
  }

  const normalizedIdentifier = typeof adminUser.email === 'string' ? adminUser.email.trim() : '';

  if (!normalizedIdentifier) {
    return null;
  }

  return adminRepository.findByEmail(normalizedIdentifier)
    || adminRepository.findByUsername(normalizedIdentifier);
}

function createAdminJsCurrentAdmin(admin) {
  if (!admin) {
    return null;
  }

  return {
    email: admin.email || admin.username,
    title: admin.displayName || admin.username,
  };
}

function createAdminJsSessionRevalidationMiddleware({ adminRepository, cookieName = ADMINJS_COOKIE_NAME } = {}) {
  return (req, res, next) => {
    const adminUser = req.session?.adminUser;

    if (!adminUser) {
      return next();
    }

    const admin = findAdminForAdminJsSession(adminUser, adminRepository);

    if (!admin || !admin.isActive) {
      if (!req.session) {
        res.clearCookie(cookieName, ADMINJS_SESSION_COOKIE_OPTIONS);
        return res.redirect('/admin-next/login');
      }

      return req.session.destroy(() => {
        res.clearCookie(cookieName, ADMINJS_SESSION_COOKIE_OPTIONS);
        res.redirect('/admin-next/login');
      });
    }

    const currentAdmin = createAdminJsCurrentAdmin(admin);

    if (adminUser.email !== currentAdmin.email || adminUser.title !== currentAdmin.title) {
      req.session.adminUser = currentAdmin;
    }

    return next();
  };
}

function buildAdminJsAuth({ adminRepository, sessionSecret } = {}) {
  const cookieSecret = sessionSecret || resolveSessionSecret();

  return {
    authentication: {
      authenticate: (identifier, password) => authenticate(identifier, password, adminRepository),
      cookieName: ADMINJS_COOKIE_NAME,
      cookiePassword: cookieSecret,
    },
    sessionOptions: {
      resave: false,
      saveUninitialized: false,
      secret: cookieSecret,
      unset: 'destroy',
      cookie: {
        ...ADMINJS_SESSION_COOKIE_OPTIONS,
      },
    },
  };
}

module.exports = {
  ADMINJS_COOKIE_NAME,
  ADMINJS_SESSION_COOKIE_OPTIONS,
  authenticate,
  authenticateAdmin: authenticate,
  buildAdminJsAuth,
  createAdminJsCurrentAdmin,
  createAdminJsSessionRevalidationMiddleware,
  findAdminForAdminJsSession,
};
