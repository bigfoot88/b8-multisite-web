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

function resolveSiteByHost(siteRepository, hostname) {
  return siteRepository.listSiteSettings().find((site) => site.domain === hostname) || null;
}

function createApp({ databasePath, sessionSecret, uploadRoot: explicitUploadRoot } = {}) {
  const app = express();
  const cookieSecret = sessionSecret || resolveSessionSecret();
  const db = openDatabase(databasePath);
  const publicRoot = path.join(__dirname, '..', 'public');
  const uploadRoot = explicitUploadRoot || path.join(publicRoot, 'uploads');

  runMigrations(db);

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.locals.db = db;
  app.locals.adminRepository = createAdminRepository(db);
  app.locals.siteRepository = createSiteRepository(db);
  app.locals.catalogRepository = createCatalogRepository(db);
  app.locals.mediaRepository = createMediaRepository(db);
  app.locals.uploadRoot = uploadRoot;

  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser(cookieSecret));
  app.use('/css', express.static(path.join(publicRoot, 'css')));
  app.use('/uploads', express.static(uploadRoot));
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

  app.get('/', (req, res) => {
    const site = resolveSiteByHost(app.locals.siteRepository, req.hostname);
    const publishedSections = site ? app.locals.siteRepository.listPublishedSections(site.siteKey) : [];
    const heroSection = publishedSections.find((section) => section.sectionKey === 'hero' || section.sectionKey === 'hero-banner') || publishedSections[0] || null;

    res.render('public/landing', {
      title: site?.seoTitle || 'B8 Multisite Platform',
      site,
      heroSection,
      publishedSections,
    });
  });

  return app;
}

module.exports = {
  createApp,
};
