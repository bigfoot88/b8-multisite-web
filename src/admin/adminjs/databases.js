const fs = require('node:fs');
const path = require('node:path');

const { resolveDatabasePath } = require('../../lib/db');

function enableSqliteWal(connection) {
  return new Promise((resolve, reject) => {
    const onComplete = (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    };

    if (typeof connection.run === 'function') {
      connection.run('PRAGMA journal_mode = WAL', onComplete);
      return;
    }

    if (typeof connection.exec === 'function') {
      connection.exec('PRAGMA journal_mode = WAL', onComplete);
      return;
    }

    resolve();
  });
}

async function createAdminJsDatabases({ databasePath } = {}) {
  const { Sequelize } = await import('sequelize');
  const storage = databasePath === ':memory:' ? ':memory:' : resolveDatabasePath(databasePath);

  if (storage !== ':memory:') {
    fs.mkdirSync(path.dirname(storage), { recursive: true });
  }

  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage,
    logging: false,
    hooks: {
      afterConnect: enableSqliteWal,
    },
    pool: {
      max: 1,
      min: 0,
      idle: 1_000,
    },
  });

  return {
    databases: [sequelize],
    sequelize,
  };
}

module.exports = {
  createAdminJsDatabases,
  enableSqliteWal,
};
