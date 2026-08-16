#!/bin/bash
# Wrapper script for mcp-debugger to ensure stdio mode works correctly with Claude Code
# This script ensures the 'stdio' argument is passed when needed

# Check if we're being run by Claude Code (usually no arguments or just transport-related args)
# The MCP SDK typically uses STDIO by default when no transport is specified
# Check for --transport as a discrete argument token (not a substring of "$*",
# which would misfire if any argument value happened to contain "--transport")
has_transport=false
for arg in "$@"; do
    if [ "$arg" = "--transport" ]; then
        has_transport=true
        break
    fi
done
if [ $# -eq 0 ] || [ "$has_transport" = false ]; then
    # Add stdio argument to ensure console output is suppressed
    exec node "$(dirname "$0")/dist/index.js" stdio "$@"
else
    # Pass through all arguments as-is for other transport modes
    exec node "$(dirname "$0")/dist/index.js" "$@"
fi