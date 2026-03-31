const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { createAdminJsDatabases } = require('../src/admin/adminjs/databases');

function createScratchPaths() {
  const tempDir = path.join(
    __dirname,
    '.scratch',
    `admin-adminjs-databases-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );

  fs.mkdirSync(tempDir, { recursive: true });

  return {
    tempDir,
    databasePath: path.join(tempDir, 'adminjs.sqlite'),
  };
}

test('createAdminJsDatabases leaves SQLite in WAL mode at runtime', async (t) => {
  const paths = createScratchPaths();
  t.after(() => {
    fs.rmSync(paths.tempDir, { recursive: true, force: true });
  });

  const { sequelize } = await createAdminJsDatabases({ databasePath: paths.databasePath });
  t.after(async () => {
    await sequelize.close();
  });

  await sequelize.authenticate();
  const [rows] = await sequelize.query('PRAGMA journal_mode;');

  assert.equal(rows[0]?.journal_mode, 'wal');
});
