const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

function resolveDatabasePath(filename = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'content.db')) {
  return path.isAbsolute(filename) ? filename : path.join(process.cwd(), filename);
}

function createDatabase(filename = ':memory:') {
  const target = filename === ':memory:' ? filename : resolveDatabasePath(filename);

  if (target !== ':memory:') {
    fs.mkdirSync(path.dirname(target), { recursive: true });
  }

  const db = new Database(target);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  return db;
}

function openDatabase(filename) {
  return createDatabase(filename || resolveDatabasePath());
}

module.exports = {
  createDatabase,
  openDatabase,
  resolveDatabasePath,
};
