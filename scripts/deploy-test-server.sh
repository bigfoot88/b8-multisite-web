#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOY_PATH:?DEPLOY_PATH is required}"
: "${DEPLOY_SERVICE:?DEPLOY_SERVICE is required}"
DEPLOY_PORT="${DEPLOY_PORT:-3008}"

cd "$DEPLOY_PATH"
git fetch origin dev
git reset --hard origin/dev
npm ci --omit=dev
sudo -n /usr/bin/systemctl restart "${DEPLOY_SERVICE}.service"
attempt=0
until curl -fsS "http://127.0.0.1:${DEPLOY_PORT}/" >/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "Health check failed on port ${DEPLOY_PORT}" >&2
    exit 1
  fi
  sleep 1
done

echo "Deploy complete for ${DEPLOY_SERVICE} at ${DEPLOY_PATH} (port ${DEPLOY_PORT})."
