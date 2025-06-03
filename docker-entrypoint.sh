#!/bin/sh
set -e

# Use mounted workspace if provided
if [ -d "/workspace" ]; then
  cd /workspace
fi

# Start debugpy adapter in background
python3 tests/fixtures/python/debugpy_server.py --host 0.0.0.0 --port 5679 --no-wait &
DBG_PID=$!

# Start the MCP server (compiled JS)
node dist/index.js --log-level debug

# Graceful shutdown
trap "kill $DBG_PID" INT TERM
wait
