const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SCRIPT_PATH = path.join(__dirname, '..', 'scripts', 'deploy-test-server.sh');
const script = fs.readFileSync(SCRIPT_PATH, 'utf8');

const REQUIRED_LINES = [
  'set -euo pipefail',
  ': "${DEPLOY_PATH:?DEPLOY_PATH is required}"',
  ': "${DEPLOY_SERVICE:?DEPLOY_SERVICE is required}"',
  'DEPLOY_PORT="${DEPLOY_PORT:-3008}"',
  'cd "$DEPLOY_PATH"',
  'git fetch origin dev',
  'git reset --hard origin/dev',
  'npm ci --omit=dev',
  'systemctl restart "$DEPLOY_SERVICE"',
  'curl -fsS "http://127.0.0.1:${DEPLOY_PORT}/"',
];

test('deploy script contains required commands', () => {
  for (const line of REQUIRED_LINES) {
    assert.ok(
      script.includes(line),
      `expected deploy script to include: ${line}`,
    );
  }
});
