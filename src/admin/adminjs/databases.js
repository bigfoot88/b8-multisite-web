const fs = require('node:fs');
const path = require('node:path');
const session = require('express-session');
const SqliteStoreFactory = require('connect-sqlite3');

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

function installSqliteWalRuntimeHook(sequelize) {
  const configuredConnections = new WeakSet();
  const originalGetConnection = sequelize.connectionManager.getConnection.bind(sequelize.connectionManager);

  sequelize.connectionManager.getConnection = async function getConnectionWithWal(...args) {
    const connection = await originalGetConnection(...args);

    if (!configuredConnections.has(connection)) {
      await enableSqliteWal(connection);
      configuredConnections.add(connection);
    }

    return connection;
  };
}

function resolveAdminJsSessionDatabasePath(databasePath) {
  if (!databasePath || databasePath === ':memory:') {
    return resolveDatabasePath(path.join('data', 'sessions.db'));
  }

  return path.join(path.dirname(resolveDatabasePath(databasePath)), 'sessions.db');
}

function createAdminJsSessionStore({ databasePath } = {}) {
  const sessionDatabasePath = resolveAdminJsSessionDatabasePath(databasePath);
  const SQLiteStore = SqliteStoreFactory(session);

  fs.mkdirSync(path.dirname(sessionDatabasePath), { recursive: true });

  return {
    sessionDatabasePath,
    sessionStore: new SQLiteStore({
      db: path.basename(sessionDatabasePath),
      dir: path.dirname(sessionDatabasePath),
      concurrentDb: true,
      createDirIfNotExists: true,
    }),
  };
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

  installSqliteWalRuntimeHook(sequelize);
  const { sessionDatabasePath, sessionStore } = createAdminJsSessionStore({ databasePath });

  return {
    databases: [sequelize],
    sequelize,
    sessionDatabasePath,
    sessionStore,
  };
}

module.exports = {
  createAdminJsSessionStore,
  createAdminJsDatabases,
  enableSqliteWal,
  installSqliteWalRuntimeHook,
  resolveAdminJsSessionDatabasePath,
};
