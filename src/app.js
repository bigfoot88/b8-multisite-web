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
const { ADMINJS_ROOT_PATH, createAdminJsRouter, isAdminJsPath } = require('./admin/adminjs');
const { createMediaRouter } = require('./routes/media');
const { createPublicSiteService } = require('./services/public-site-service');
const { createPublicRouter } = require('./routes/public');
const { createAdminAuthRouter } = require('./routes/admin-auth');
const { createAdminDashboardRouter } = require('./routes/admin-dashboard');
const { createAdminSitesRouter } = require('./routes/admin-sites');
const { createAdminSectionsRouter } = require('./routes/admin-sections');
const { createAdminNavigationRouter } = require('./routes/admin-navigation');
const { createAdminPagesRouter } = require('./routes/admin-pages');
const { createAdminCatalogRouter } = require('./routes/admin-catalog');
const { createAdminNewsRouter } = require('./routes/admin-news');
const { createAdminCasesRouter } = require('./routes/admin-cases');
const { createAdminMediaRouter } = require('./routes/admin-media');

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
  app.locals.adminJs = null;

  app.use((req, res, next) => {
    if (isAdminJsPath(req.path)) {
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
  const adminJsRouter = createAdminJsRouter({
    adminRepository: app.locals.adminRepository,
    databasePath,
    sessionSecret: cookieSecret,
  });
  app.locals.adminJs = adminJsRouter.adminJs;
  app.use(ADMINJS_ROOT_PATH, adminJsRouter);
  app.use('/admin', createAdminAuthRouter({ adminRepository: app.locals.adminRepository }));
  app.use('/admin', createAdminSitesRouter());
  app.use('/admin', createAdminSectionsRouter());
  app.use('/admin', createAdminNavigationRouter());
  app.use('/admin', createAdminPagesRouter());
  app.use('/admin', createAdminCatalogRouter({
    collectionKey: 'products',
    pathSegment: 'products',
    pageTitle: '产品管理',
    pageDescription: '维护产品标题、摘要、正文与发布状态。',
    listView: '../admin/lists/products',
    formView: '../admin/forms/product',
    emptyRecord: {
      id: null,
      slug: '',
      title: '',
      summary: '',
      bodyHtml: '',
      brochureMediaId: '',
      attachmentMediaId: '',
      seoTitle: '',
      seoDescription: '',
      sortOrder: 100,
      publishState: 'draft',
    },
  }));
  app.use('/admin', createAdminCatalogRouter({
    collectionKey: 'solutions',
    pathSegment: 'solutions',
    pageTitle: '解决方案管理',
    pageDescription: '维护解决方案内容、摘要与发布状态。',
    listView: '../admin/lists/solutions',
    formView: '../admin/forms/solution',
    emptyRecord: {
      id: null,
      slug: '',
      title: '',
      summary: '',
      bodyHtml: '',
      attachmentMediaId: '',
      seoTitle: '',
      seoDescription: '',
      sortOrder: 100,
      publishState: 'draft',
    },
  }));
  app.use('/admin', createAdminNewsRouter());
  app.use('/admin', createAdminCasesRouter());
  app.use('/admin', createAdminMediaRouter({ uploadRoot }));
  app.use('/admin', createAdminDashboardRouter());

  app.get('/health', (req, res) => {
    res.json({ ok: true, sites });
  });

  app.use('/', createPublicRouter({
    siteRepository: app.locals.siteRepository,
    publicSiteService: app.locals.publicSiteService,
  }));

  let isClosed = false;
  app.close = async () => {
    if (isClosed) {
      return;
    }

    isClosed = true;
    const errors = [];

    try {
      await app.locals.adminJs?.close?.();
    } catch (error) {
      errors.push(error);
    }

    try {
      app.locals.db.close();
    } catch (error) {
      errors.push(error);
    }

    if (errors[0]) {
      throw errors[0];
    }
  };
  app.locals.close = app.close;

  return app;
}

module.exports = {
  createApp,
};
