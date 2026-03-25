const path = require('node:path');
const express = require('express');

const { sites } = require('./config/sites');

function createApp() {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  app.use('/css', express.static(path.join(__dirname, '..', 'public', 'css')));

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
