const express = require('express');

const { verifyPassword } = require('../../lib/passwords');
const { resolveSessionSecret } = require('../../lib/session');
const { createAdminJsDatabases } = require('./databases');

const ADMINJS_ROOT_PATH = '/admin';
const ADMINJS_COOKIE_NAME = 'b8_adminjs';
const ADMINJS_COMPANY_NAME = 'B8 AdminJS';

let adapterRegistered = false;

async function loadAdminJsModules() {
  const [adminJsModule, adminJsExpressModule, adminJsSequelizeModule] = await Promise.all([
    import('adminjs'),
    import('@adminjs/express'),
    import('@adminjs/sequelize'),
  ]);

  const AdminJS = adminJsModule.default || adminJsModule;
  const AdminJSExpress = adminJsExpressModule.default || adminJsExpressModule;
  const AdminJSSequelize = adminJsSequelizeModule.default || adminJsSequelizeModule;

  if (!adapterRegistered) {
    AdminJS.registerAdapter({
      Database: AdminJSSequelize.Database,
      Resource: AdminJSSequelize.Resource,
    });
    adapterRegistered = true;
  }

  return {
    AdminJS,
    AdminJSExpress,
  };
}

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

async function buildAdminJsRouter({ adminRepository, databasePath, sessionSecret } = {}) {
  const [{ AdminJS, AdminJSExpress }, { databases }] = await Promise.all([
    loadAdminJsModules(),
    createAdminJsDatabases({ databasePath }),
  ]);
  const cookieSecret = sessionSecret || resolveSessionSecret();
  const admin = new AdminJS({
    rootPath: ADMINJS_ROOT_PATH,
    databases,
    resources: [],
    branding: {
      companyName: ADMINJS_COMPANY_NAME,
      withMadeWithLove: false,
    },
  });

  return AdminJSExpress.buildAuthenticatedRouter(
    admin,
    {
      authenticate: (identifier, password) => authenticateAdmin(identifier, password, adminRepository),
      cookieName: ADMINJS_COOKIE_NAME,
      cookiePassword: cookieSecret,
    },
    undefined,
    {
      resave: false,
      saveUninitialized: false,
      secret: cookieSecret,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
      },
    },
  );
}

function createAdminJsRouter(options = {}) {
  const router = express.Router();
  let adminRouterPromise;

  router.use((req, res, next) => {
    if (!adminRouterPromise) {
      adminRouterPromise = buildAdminJsRouter(options);
    }

    adminRouterPromise
      .then((adminRouter) => adminRouter(req, res, next))
      .catch(next);
  });

  return router;
}

module.exports = {
  ADMINJS_COOKIE_NAME,
  ADMINJS_ROOT_PATH,
  createAdminJsRouter,
};
