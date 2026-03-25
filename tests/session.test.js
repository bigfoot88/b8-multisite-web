const test = require('node:test');
const assert = require('node:assert/strict');

const APP_MODULE_PATH = require.resolve('../src/app');
const SESSION_MODULE_PATH = require.resolve('../src/lib/session');

test('requires ADMIN_SESSION_SECRET in production', () => {
  assert.throws(
    () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalAdminSessionSecret = process.env.ADMIN_SESSION_SECRET;

      delete require.cache[APP_MODULE_PATH];
      delete require.cache[SESSION_MODULE_PATH];
      process.env.NODE_ENV = 'production';
      delete process.env.ADMIN_SESSION_SECRET;

      try {
        const { createApp } = require('../src/app');
        const app = createApp();
        app.locals.db.close();
      } finally {
        delete require.cache[APP_MODULE_PATH];
        delete require.cache[SESSION_MODULE_PATH];

        if (originalNodeEnv === undefined) {
          delete process.env.NODE_ENV;
        } else {
          process.env.NODE_ENV = originalNodeEnv;
        }

        if (originalAdminSessionSecret === undefined) {
          delete process.env.ADMIN_SESSION_SECRET;
        } else {
          process.env.ADMIN_SESSION_SECRET = originalAdminSessionSecret;
        }
      }
    },
    /ADMIN_SESSION_SECRET must be set in production/,
  );
});

test('allows an explicit session secret override in production', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAdminSessionSecret = process.env.ADMIN_SESSION_SECRET;

  delete require.cache[APP_MODULE_PATH];
  delete require.cache[SESSION_MODULE_PATH];
  process.env.NODE_ENV = 'production';
  delete process.env.ADMIN_SESSION_SECRET;

  try {
    const { createApp } = require('../src/app');
    const app = createApp({ sessionSecret: 'override-secret' });
    app.locals.db.close();
  } finally {
    delete require.cache[APP_MODULE_PATH];
    delete require.cache[SESSION_MODULE_PATH];

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalAdminSessionSecret === undefined) {
      delete process.env.ADMIN_SESSION_SECRET;
    } else {
      process.env.ADMIN_SESSION_SECRET = originalAdminSessionSecret;
    }
  }
});
