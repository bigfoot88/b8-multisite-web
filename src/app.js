const path = require('node:path');
const express = require('express');
const cookieParser = require('cookie-parser');

const { sites } = require('./config/sites');
const { openDatabase } = require('./lib/db');
const { runMigrations } = require('./lib/migrations');
const { resolveSessionSecret } = require('./lib/session');
const { createAdminRepository } = require('./repositories/admin-repository');
const { createAdminAuthRouter } = require('./routes/admin-auth');
const { createAdminDashboardRouter } = require('./routes/admin-dashboard');

function createApp({ databasePath, sessionSecret } = {}) {
  const app = express();
  const cookieSecret = sessionSecret || resolveSessionSecret();
  const db = openDatabase(databasePath);

  runMigrations(db);

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.locals.db = db;
  app.locals.adminRepository = createAdminRepository(db);

  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser(cookieSecret));
  app.use('/css', express.static(path.join(__dirname, '..', 'public', 'css')));
  app.use('/admin', createAdminAuthRouter({ adminRepository: app.locals.adminRepository }));
  app.use('/admin', createAdminDashboardRouter());

  app.get('/health', (req, res) => {
    res.json({ ok: true, sites });
  });

  app.get('/', (req, res) => {
    res.render('public/landing', { title: 'B8 Multisite Platform' });
  });

  return app;
}

module.exports = {
  createApp,
};
