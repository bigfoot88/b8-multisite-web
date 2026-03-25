const fs = require('node:fs');
const path = require('node:path');

const schemaPath = path.join(__dirname, 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');

function runMigrations(db) {
  db.exec(schemaSql);
  return db;
}

module.exports = {
  runMigrations,
};
