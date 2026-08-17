#!/bin/bash
# Wrapper script for mcp-debugger, kept for backward compatibility with configs
# that point at it. The CLI already defaults to the 'stdio' subcommand when no
# subcommand is given (isDefault in src/cli/setup.ts), so all arguments pass
# through unchanged and transport subcommands (http, sse) route correctly.
exec node "$(dirname "$0")/dist/index.js" "$@"
