const path = require('node:path');
const express = require('express');
const cookieParser = require('cookie-parser');

const { sites } = require('./config/sites');
const { openDatabase } = require('./lib/db');
const { runMigrations } = require('./lib/migrations');
const { resolveSessionSecret } = require('./lib/session');
const { createAdminRepository } = require('./repositories/admin-repository');
const { createSiteRepository } = require('./repositories/site-repository');
const { createCatalogRepository } = require('./repositories/catalog-repository');
const { createMediaRepository } = require('./repositories/media-repository');
const { createRedirectRepository } = require('./repositories/redirect-repository');
const { createAdminJsRouter } = require('./admin/adminjs');
const { createMediaRouter } = require('./routes/media');
const { createPublicSiteService } = require('./services/public-site-service');
const { createPublicRouter } = require('./routes/public');

function createApp({ databasePath, sessionSecret, uploadRoot: explicitUploadRoot } = {}) {
  const app = express();
  const cookieSecret = sessionSecret || resolveSessionSecret();
  const db = openDatabase(databasePath);
  const publicRoot = path.join(__dirname, '..', 'public');
  const uploadRoot = explicitUploadRoot || path.join(publicRoot, 'uploads');
  const publicUrlEncoded = express.urlencoded({ extended: false });

  runMigrations(db);

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.locals.db = db;
  app.locals.adminRepository = createAdminRepository(db);
  app.locals.siteRepository = createSiteRepository(db);
  app.locals.catalogRepository = createCatalogRepository(db);
  app.locals.mediaRepository = createMediaRepository(db, { uploadRoot });
  app.locals.redirectRepository = createRedirectRepository(db);
  app.locals.publicSiteService = createPublicSiteService({
    siteRepository: app.locals.siteRepository,
    catalogRepository: app.locals.catalogRepository,
    mediaRepository: app.locals.mediaRepository,
    redirectRepository: app.locals.redirectRepository,
  });
  app.locals.uploadRoot = uploadRoot;

  app.use((req, res, next) => {
    if (req.path === '/admin' || req.path.startsWith('/admin/')) {
      return next();
    }

    return publicUrlEncoded(req, res, next);
  });
  app.use(cookieParser(cookieSecret));
  app.use('/css', express.static(path.join(publicRoot, 'css')));
  app.use('/js', express.static(path.join(publicRoot, 'js')));
  app.use('/uploads', express.static(uploadRoot, {
    setHeaders(res) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  }));
  app.use('/media', createMediaRouter({
    adminRepository: app.locals.adminRepository,
    mediaRepository: app.locals.mediaRepository,
    siteRepository: app.locals.siteRepository,
  }));
  app.use('/admin', createAdminJsRouter({
    adminRepository: app.locals.adminRepository,
    databasePath,
    sessionSecret: cookieSecret,
  }));

  app.get('/health', (req, res) => {
    res.json({ ok: true, sites });
  });

  app.use('/', createPublicRouter({
    siteRepository: app.locals.siteRepository,
    publicSiteService: app.locals.publicSiteService,
  }));

  return app;
}

module.exports = {
  createApp,
};
