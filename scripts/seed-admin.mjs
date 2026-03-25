import path from 'node:path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';

import { openDatabase } from '../src/lib/db.js';
import { runMigrations } from '../src/lib/migrations.js';
import { createAdminRepository } from '../src/repositories/admin-repository.js';
import { createSiteBootstrap } from '../src/lib/site-bootstrap.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const email = process.env.ADMIN_EMAIL || 'admin@b8.local';
const username = process.env.ADMIN_USERNAME || 'admin';
const password = process.env.ADMIN_PASSWORD?.trim();
const displayName = process.env.ADMIN_DISPLAY_NAME || 'Platform Admin';
const targetDatabasePath = process.env.DATABASE_PATH
  ? (path.isAbsolute(process.env.DATABASE_PATH) ? process.env.DATABASE_PATH : path.join(projectRoot, process.env.DATABASE_PATH))
  : path.join(projectRoot, 'data', 'content.db');

if (!password) {
  console.error('ADMIN_PASSWORD must be provided to seed an admin account.');
  process.exit(1);
}

const db = openDatabase(targetDatabasePath);
runMigrations(db);

const adminRepository = createAdminRepository(db);
const { ensureSite } = createSiteBootstrap(db);

ensureSite('dma');
ensureSite('bigfoot');

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
console.log(`Seeded admin account username=${username} using ADMIN_PASSWORD`);
