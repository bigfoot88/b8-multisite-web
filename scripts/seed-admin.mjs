import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';

import { openDatabase } from '../src/lib/db.js';
import { runMigrations } from '../src/lib/migrations.js';
import { createSiteRepository } from '../src/repositories/site-repository.js';
import { createAdminRepository } from '../src/repositories/admin-repository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function loadSeed(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), 'utf8'));
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

const email = process.env.ADMIN_EMAIL || 'admin@b8.local';
const username = process.env.ADMIN_USERNAME || 'admin';
const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
const displayName = process.env.ADMIN_DISPLAY_NAME || 'Platform Admin';
const targetDatabasePath = process.env.DATABASE_PATH
  ? (path.isAbsolute(process.env.DATABASE_PATH) ? process.env.DATABASE_PATH : path.join(projectRoot, process.env.DATABASE_PATH))
  : path.join(projectRoot, 'data', 'content.db');

const db = openDatabase(targetDatabasePath);
runMigrations(db);

const siteRepository = createSiteRepository(db);
const adminRepository = createAdminRepository(db);

applySiteSeed(siteRepository, loadSeed('data/seeds/dma.json'));
applySiteSeed(siteRepository, loadSeed('data/seeds/bigfoot.json'));

if (!adminRepository.findByUsername(username)) {
  const passwordHash = bcrypt.hashSync(password, 10);
  adminRepository.createAdmin({
    username,
    email,
    passwordHash,
    displayName,
  });
}

console.log(`Seeded admin and default site settings into ${path.relative(projectRoot, targetDatabasePath)}`);
if (process.env.ADMIN_PASSWORD) {
  console.log(`Seeded admin credentials username=${username} using ADMIN_PASSWORD`);
} else {
  console.log(`Seeded default admin credentials username=${username} password=${password}`);
}
