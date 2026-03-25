#!/bin/sh
# Docker entrypoint for mcp-debugger
# Ensure log directory exists
mkdir -p /app/logs 2>/dev/null || true
# Log early startup context
{
  echo "==== entry.sh ===="
  date
  echo "argv: $*"
} >> /app/logs/entry.log 2>&1
export MCP_WORKSPACE_ROOT="${MCP_WORKSPACE_ROOT:-/workspace}"
exec node --no-warnings -r /app/scripts/stdio-silencer.cjs dist/bundle.cjs "$@"
