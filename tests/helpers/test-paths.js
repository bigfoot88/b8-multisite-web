const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const bcrypt = require('bcryptjs');

const { createDatabase } = require('../../src/lib/db');
const { runMigrations } = require('../../src/lib/migrations');
const { createSiteRepository } = require('../../src/repositories/site-repository');
const { createAdminRepository } = require('../../src/repositories/admin-repository');

function loadJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8'));
}

function applySiteSeed(siteRepository, seed) {
  siteRepository.upsertSiteSettings(seed.site);
  siteRepository.replaceNavigation(seed.site.siteKey, seed.navigation || []);

  for (const section of seed.siteSections || []) {
    siteRepository.saveSection({
      siteKey: seed.site.siteKey,
      sectionKey: section.sectionKey,
      heading: section.heading,
      subheading: section.subheading,
      body: section.body,
      config: section.config || {},
      sortOrder: section.sortOrder || 0,
      isPublished: section.isPublished !== false,
    });
  }
}

function createSeededAppPaths(prefix = 'b8-admin-crud-') {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const databasePath = path.join(tempDir, 'content.db');
  const db = createDatabase(databasePath);
  runMigrations(db);

  const siteRepository = createSiteRepository(db);
  const adminRepository = createAdminRepository(db);

  applySiteSeed(siteRepository, loadJson('data/seeds/dma.json'));
  applySiteSeed(siteRepository, loadJson('data/seeds/bigfoot.json'));

  adminRepository.createAdmin({
    username: 'admin',
    email: 'admin@b8.local',
    passwordHash: bcrypt.hashSync('ChangeMe123!', 10),
    displayName: '平台管理员',
  });

  db.close();

  return {
    tempDir,
    databasePath,
    uploadRoot: path.join(tempDir, 'uploads'),
  };
}

const fixturesDir = path.join(__dirname, '..', 'fixtures');
const logoFixturePath = path.join(fixturesDir, 'logo.png');
const replacementLogoFixturePath = path.join(fixturesDir, 'logo-replacement.png');

module.exports = {
  createSeededAppPaths,
  fixturesDir,
  logoFixturePath,
  replacementLogoFixturePath,
};
