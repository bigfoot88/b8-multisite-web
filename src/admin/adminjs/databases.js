const fs = require('node:fs');
const path = require('node:path');
const session = require('express-session');
const Database = require('better-sqlite3');

const { resolveDatabasePath } = require('../../lib/db');

/**
 * Minimal express-session store backed by better-sqlite3.
 * Avoids the connect-sqlite3 dependency which requires GLIBC 2.38+.
 */
function createBetterSqliteStore(SessionStore) {
  class BetterSqliteStore extends SessionStore {
    constructor({ db: dbPath, dir, ttl = 86400 } = {}) {
      super();
      this.ttl = ttl;
      const fullPath = dir ? path.join(dir, dbPath) : dbPath;
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      this.db = new Database(fullPath);
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          sid TEXT PRIMARY KEY,
          sess TEXT NOT NULL,
          expired INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired);
      `);
      // Prune expired sessions periodically
      this._pruneTimer = setInterval(() => this._prune(), 60_000).unref();
    }

    _prune() {
      this.db.prepare('DELETE FROM sessions WHERE expired <= ?').run(Date.now());
    }

    get(sid, cb) {
      try {
        const row = this.db.prepare('SELECT sess FROM sessions WHERE sid=? AND expired > ?').get(sid, Date.now());
        cb(null, row ? JSON.parse(row.sess) : null);
      } catch (e) { cb(e); }
    }

    set(sid, sess, cb) {
      try {
        const ttl = (sess.cookie?.maxAge ?? this.ttl) * 1000;
        const expired = Date.now() + ttl;
        const json = JSON.stringify(sess);
        this.db.prepare('INSERT OR REPLACE INTO sessions (sid, sess, expired) VALUES (?,?,?)').run(sid, json, expired);
        cb(null);
      } catch (e) { cb(e); }
    }

    destroy(sid, cb) {
      try {
        this.db.prepare('DELETE FROM sessions WHERE sid=?').run(sid);
        cb(null);
      } catch (e) { cb(e); }
    }

    touch(sid, sess, cb) {
      try {
        const ttl = (sess.cookie?.maxAge ?? this.ttl) * 1000;
        const expired = Date.now() + ttl;
        this.db.prepare('UPDATE sessions SET expired=? WHERE sid=?').run(expired, sid);
        cb(null);
      } catch (e) { cb(e); }
    }

    close() {
      clearInterval(this._pruneTimer);
      this.db.close();
    }
  }

  return BetterSqliteStore;
}

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
  const SQLiteStore = createBetterSqliteStore(session.Store);
  const sessionArtifactsPath = databasePath === ':memory:'
    ? path.dirname(sessionDatabasePath)
    : null;

  fs.mkdirSync(path.dirname(sessionDatabasePath), { recursive: true });

  const sessionStore = new SQLiteStore({
    db: path.basename(sessionDatabasePath),
    dir: path.dirname(sessionDatabasePath),
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
      sessionStore?.close?.();
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
