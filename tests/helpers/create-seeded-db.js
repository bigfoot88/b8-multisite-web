const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');

const { createDatabase } = require('../../src/lib/db');
const { runMigrations } = require('../../src/lib/migrations');
const { createSiteRepository } = require('../../src/repositories/site-repository');
const { createAdminRepository } = require('../../src/repositories/admin-repository');

function loadJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8'));
}

function createTestDb() {
  return createDatabase(':memory:');
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

function createSeededDb({
  username = 'admin',
  adminEmail = 'admin@b8.local',
  passwordHash = bcrypt.hashSync('ChangeMe123!', 10),
  displayName = 'Platform Admin',
} = {}) {
  const db = createTestDb();
  runMigrations(db);

  const siteRepository = createSiteRepository(db);
  const adminRepository = createAdminRepository(db);

  applySiteSeed(siteRepository, loadJson('data/seeds/dma.json'));
  applySiteSeed(siteRepository, loadJson('data/seeds/bigfoot.json'));

  if (!adminRepository.findByUsername(username)) {
    adminRepository.createAdmin({
      username,
      email: adminEmail,
      passwordHash,
      displayName,
    });
  }

  return db;
}

module.exports = {
  createTestDb,
  createSeededDb,
};
