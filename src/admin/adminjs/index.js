const express = require('express');

const { ADMINJS_COOKIE_NAME, buildAdminJsAuth } = require('./auth');
const { createAdminJsDatabases } = require('./databases');

const ADMINJS_ROOT_PATH = '/admin-next';
const ADMINJS_LOGIN_PATH = `${ADMINJS_ROOT_PATH}/login`;
const ADMINJS_LOGOUT_PATH = `${ADMINJS_ROOT_PATH}/logout`;
const ADMINJS_REFRESH_TOKEN_PATH = `${ADMINJS_ROOT_PATH}/refresh-token`;
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

function isAdminJsPath(pathname) {
  return pathname === ADMINJS_ROOT_PATH || pathname.startsWith(`${ADMINJS_ROOT_PATH}/`);
}

async function buildAdminJsRouter({ adminRepository, databasePath, sessionSecret } = {}) {
  const [{ AdminJS, AdminJSExpress }, { databases, sessionStore }] = await Promise.all([
    loadAdminJsModules(),
    createAdminJsDatabases({ databasePath }),
  ]);
  const { authentication, sessionOptions } = buildAdminJsAuth({
    adminRepository,
    sessionSecret,
  });
  sessionOptions.store = sessionStore;
  const admin = new AdminJS({
    rootPath: ADMINJS_ROOT_PATH,
    loginPath: ADMINJS_LOGIN_PATH,
    logoutPath: ADMINJS_LOGOUT_PATH,
    refreshTokenPath: ADMINJS_REFRESH_TOKEN_PATH,
    databases,
    resources: [],
    branding: {
      companyName: ADMINJS_COMPANY_NAME,
      withMadeWithLove: false,
    },
  });

  return AdminJSExpress.buildAuthenticatedRouter(
    admin,
    authentication,
    undefined,
    sessionOptions,
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
  ADMINJS_LOGIN_PATH,
  ADMINJS_LOGOUT_PATH,
  ADMINJS_REFRESH_TOKEN_PATH,
  ADMINJS_ROOT_PATH,
  createAdminJsRouter,
  isAdminJsPath,
};
