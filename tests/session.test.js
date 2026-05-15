const test = require('node:test');
const assert = require('node:assert/strict');

const APP_MODULE_PATH = require.resolve('../src/app');
const SESSION_MODULE_PATH = require.resolve('../src/lib/session');

test('admin cookie options are secure in production', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAdminCookieSecure = process.env.ADMIN_COOKIE_SECURE;

  delete require.cache[SESSION_MODULE_PATH];
  process.env.NODE_ENV = 'production';
  delete process.env.ADMIN_COOKIE_SECURE;

  try {
    const { createAdminCookieOptions } = require('../src/lib/session');
    assert.equal(createAdminCookieOptions().secure, true);
  } finally {
    delete require.cache[SESSION_MODULE_PATH];

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalAdminCookieSecure === undefined) {
      delete process.env.ADMIN_COOKIE_SECURE;
    } else {
      process.env.ADMIN_COOKIE_SECURE = originalAdminCookieSecure;
    }
  }
});

test('admin cookie options allow explicit insecure override in production', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAdminCookieSecure = process.env.ADMIN_COOKIE_SECURE;

  delete require.cache[SESSION_MODULE_PATH];
  process.env.NODE_ENV = 'production';
  process.env.ADMIN_COOKIE_SECURE = 'false';

  try {
    const { createAdminCookieOptions } = require('../src/lib/session');
    assert.equal(createAdminCookieOptions().secure, false);
  } finally {
    delete require.cache[SESSION_MODULE_PATH];

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalAdminCookieSecure === undefined) {
      delete process.env.ADMIN_COOKIE_SECURE;
    } else {
      process.env.ADMIN_COOKIE_SECURE = originalAdminCookieSecure;
    }
  }
});

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
