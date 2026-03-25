const test = require('node:test');
const assert = require('node:assert/strict');

const ENV_MODULE_PATH = require.resolve('../src/config/env');

function loadEnvWithPort(port) {
  const originalPort = process.env.PORT;

  delete require.cache[ENV_MODULE_PATH];

  if (port === undefined) {
    delete process.env.PORT;
  } else {
    process.env.PORT = port;
  }

  try {
    return require('../src/config/env');
  } finally {
    delete require.cache[ENV_MODULE_PATH];

    if (originalPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = originalPort;
    }
  }
}

test('rejects partially numeric PORT values', () => {
  assert.throws(
    () => loadEnvWithPort('123abc'),
    /PORT must be an integer between 0 and 65535/,
  );
});

test('rejects non-numeric PORT values', () => {
  assert.throws(
    () => loadEnvWithPort('notanumber'),
    /PORT must be an integer between 0 and 65535/,
  );
});
