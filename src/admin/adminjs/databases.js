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

function createEphemeralAdminJsSessionDirectory() {
  const scratchRoot = path.join(process.cwd(), '.scratch');

  fs.mkdirSync(scratchRoot, { recursive: true });

  return fs.mkdtempSync(path.join(scratchRoot, 'adminjs-session-'));
}

function resolveAdminJsSessionDatabasePath(databasePath) {
  if (!databasePath) {
    return resolveDatabasePath(path.join('data', 'sessions.db'));
  }

  if (databasePath === ':memory:') {
    return path.join(createEphemeralAdminJsSessionDirectory(), 'sessions.db');
  }

  return path.join(path.dirname(resolveDatabasePath(databasePath)), 'sessions.db');
}

function createAdminJsSessionStore({ databasePath } = {}) {
  const sessionDatabasePath = resolveAdminJsSessionDatabasePath(databasePath);
  const SQLiteStore = SqliteStoreFactory(session);
  const sessionArtifactsPath = databasePath === ':memory:'
    ? path.dirname(sessionDatabasePath)
    : null;

  fs.mkdirSync(path.dirname(sessionDatabasePath), { recursive: true });

  const sessionStore = new SQLiteStore({
    db: path.basename(sessionDatabasePath),
    dir: path.dirname(sessionDatabasePath),
    concurrentDb: true,
    createDirIfNotExists: true,
  });

  return {
    sessionDatabasePath,
    sessionArtifactsPath,
    sessionStore,
  };
}

function closeSqliteConnection(connection) {
  return new Promise((resolve, reject) => {
    if (!connection || typeof connection.close !== 'function') {
      resolve();
      return;
    }

    connection.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function createAdminJsDatabasesCloser({ sequelize, sessionStore, sessionArtifactsPath }) {
  let isClosed = false;

  return async function closeAdminJsDatabases() {
    if (isClosed) {
      return;
    }

    isClosed = true;
    const errors = [];

    try {
      await closeSqliteConnection(sessionStore?.db);
    } catch (error) {
      errors.push(error);
    }

    try {
      await sequelize.close();
    } catch (error) {
      errors.push(error);
    }

    if (sessionArtifactsPath) {
      try {
        fs.rmSync(sessionArtifactsPath, { recursive: true, force: true });
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors[0]) {
      throw errors[0];
    }
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
  const { sessionDatabasePath, sessionArtifactsPath, sessionStore } = createAdminJsSessionStore({ databasePath });

  return {
    databases: [sequelize],
    close: createAdminJsDatabasesCloser({ sequelize, sessionStore, sessionArtifactsPath }),
    sequelize,
    sessionArtifactsPath,
    sessionDatabasePath,
    sessionStore,
  };
}

module.exports = {
  createAdminJsSessionStore,
  createAdminJsDatabases,
  createAdminJsDatabasesCloser,
  enableSqliteWal,
  installSqliteWalRuntimeHook,
  resolveAdminJsSessionDatabasePath,
};
