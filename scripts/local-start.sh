#!/bin/bash
set -e

echo "Preparing to start multisite app"
pwd

echo "Ensure .env exists"
if [ ! -f .env ]; then cp .env.example .env; fi

echo ".env head:"
head -n 50 .env || true

echo "Installing dependencies (npm ci --silent)"
npm ci --silent

# determine port
PORT=$(grep -E '^PORT=' .env | cut -d= -f2 || true)
if [ -z "$PORT" ]; then PORT=3000; fi

echo "Using PORT=$PORT"

# find process listening on port
PID=$(lsof -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null || true)
if [ -n "$PID" ]; then echo "Found PID(s): $PID; killing"; for P in $PID; do /bin/kill -9 "$P" 2>/dev/null || echo "Failed to kill $P"; done; sleep 1; fi

# start server in background with nohup and capture logs

echo "Starting server (backgrounded with nohup)"
nohup npm start > server.log 2>&1 &
echo $! > server.pid
sleep 2
if [ -f server.pid ]; then echo "Server PID: $(cat server.pid)"; fi

echo "Recent logs:"
tail -n 100 server.log || true
