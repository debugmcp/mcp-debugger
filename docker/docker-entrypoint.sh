#!/bin/sh
set -e

# Use mounted workspace if provided
if [ -d "/workspace" ]; then
  cd /workspace
fi

# Start debugpy adapter in background
python3 tests/fixtures/python/debugpy_server.py --host 0.0.0.0 --port 5679 --no-wait &
DBG_PID=$!

# Graceful shutdown — use EXIT so cleanup runs on normal exit too
trap "kill $DBG_PID 2>/dev/null" EXIT INT TERM

# Start the MCP server (compiled JS)
node dist/index.js --log-level debug
