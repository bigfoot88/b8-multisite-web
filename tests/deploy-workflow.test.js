const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SCRIPT_PATH = path.join(__dirname, '..', 'scripts', 'deploy-test-server.sh');
const WORKFLOW_PATH = path.join(__dirname, '..', '.github', 'workflows', 'dev-deploy.yml');
const script = fs.readFileSync(SCRIPT_PATH, 'utf8');
const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

const REQUIRED_LINES = [
  'set -euo pipefail',
  ': "${DEPLOY_PATH:?DEPLOY_PATH is required}"',
  ': "${DEPLOY_SERVICE:?DEPLOY_SERVICE is required}"',
  'DEPLOY_PORT="${DEPLOY_PORT:-3008}"',
  'cd "$DEPLOY_PATH"',
  'git fetch origin dev',
  'git reset --hard origin/dev',
  'npm ci --omit=dev',
  'sudo -n /usr/bin/systemctl restart "${DEPLOY_SERVICE}.service"',
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

const WORKFLOW_REQUIRED_PATTERNS = [
  /on:\s*\n\s*push:\s*\n\s*branches:\s*\n\s*- dev/,
  /node-version:\s*22\.9\.0/,
  /npm ci/,
  /npm test/,
  /ssh-agent/,
  /ssh-add/,
  /-i ~\/\.ssh\/deploy_key/,
  /scripts\/deploy-test-server\.sh/,
  /bash -s/,
  /secrets\.DEPLOY_HOST/,
  /secrets\.DEPLOY_PORT/,
  /secrets\.DEPLOY_USER/,
  /secrets\.DEPLOY_PATH/,
  /secrets\.DEPLOY_SERVICE/,
  /secrets\.DEPLOY_SSH_KEY/,
  /secrets\.DEPLOY_KNOWN_HOSTS/,
];

test('workflow triggers on dev and deploys over ssh', () => {
  for (const pattern of WORKFLOW_REQUIRED_PATTERNS) {
    assert.match(
      workflow,
      pattern,
      `expected workflow to include: ${pattern}`,
    );
  }
});
