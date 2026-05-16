#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOY_PATH:?DEPLOY_PATH is required}"
: "${DEPLOY_SERVICE:?DEPLOY_SERVICE is required}"
DEPLOY_PORT="${DEPLOY_PORT:-3008}"

cd "$DEPLOY_PATH"
git fetch origin dev
git reset --hard origin/dev
npm ci --omit=dev
systemctl restart "$DEPLOY_SERVICE"
curl -fsS http://127.0.0.1:3008/

echo "Deploy complete for ${DEPLOY_SERVICE} at ${DEPLOY_PATH} (port ${DEPLOY_PORT})."
