#!/bin/sh
# Docker entrypoint for mcp-debugger
# Log early startup context
{
  echo "==== entry.sh ===="
  date
  echo "argv: $*"
} >> /app/logs/entry.log 2>&1
export MCP_WORKSPACE_ROOT="${MCP_WORKSPACE_ROOT:-/workspace}"
exec node --no-warnings -r /app/scripts/stdio-silencer.cjs dist/bundle.cjs "$@"
