const express = require('express');

const { ADMINJS_COOKIE_NAME, buildAdminJsAuth, createAdminJsSessionRevalidationMiddleware } = require('./auth');
const { createAdminJsDatabases } = require('./databases');
const { createNewsArticleResource } = require('./news-article-resource');

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
  const [{ AdminJS, AdminJSExpress }, { DataTypes }, { close, databases, sequelize, sessionDatabasePath, sessionStore }] = await Promise.all([
    loadAdminJsModules(),
    import('sequelize'),
    createAdminJsDatabases({ databasePath }),
  ]);
  const { authentication, sessionOptions } = buildAdminJsAuth({
    adminRepository,
    sessionSecret,
  });
  sessionOptions.store = sessionStore;
  const resources = [
    createNewsArticleResource(sequelize, DataTypes),
  ];
  const admin = new AdminJS({
    rootPath: ADMINJS_ROOT_PATH,
    loginPath: ADMINJS_LOGIN_PATH,
    logoutPath: ADMINJS_LOGOUT_PATH,
    refreshTokenPath: ADMINJS_REFRESH_TOKEN_PATH,
    databases,
    resources,
    branding: {
      companyName: ADMINJS_COMPANY_NAME,
      withMadeWithLove: false,
    },
  });

  const router = AdminJSExpress.buildAuthenticatedRouter(
    admin,
    authentication,
    undefined,
    sessionOptions,
  );

  const protectedRoutesLayerIndex = router.stack.findIndex(
    (layer) => layer?.handle?.name === 'authorizedRoutesMiddleware',
  );

  if (protectedRoutesLayerIndex >= 0) {
    const middlewareRouter = express.Router();
    middlewareRouter.use(createAdminJsSessionRevalidationMiddleware({ adminRepository }));
    router.stack.splice(protectedRoutesLayerIndex, 0, middlewareRouter.stack[0]);
  }

  return {
    close,
    router,
    sessionDatabasePath,
  };
}

function createAdminJsRouter(options = {}) {
  const router = express.Router();
  let adminRouterPromise;
  let sessionDatabasePath = null;
  const lifecycle = {
    async close() {
      if (!adminRouterPromise) {
        return;
      }

      const adminJs = await adminRouterPromise;
      await adminJs.close?.();
    },
  };

  Object.defineProperty(lifecycle, 'sessionDatabasePath', {
    enumerable: true,
    get() {
      return sessionDatabasePath;
    },
  });

  router.use((req, res, next) => {
    if (!adminRouterPromise) {
      adminRouterPromise = buildAdminJsRouter(options)
        .then((adminJs) => {
          sessionDatabasePath = adminJs.sessionDatabasePath;
          return adminJs;
        });
    }

    adminRouterPromise
      .then((adminJs) => adminJs.router(req, res, next))
      .catch(next);
  });

  router.adminJs = lifecycle;

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
