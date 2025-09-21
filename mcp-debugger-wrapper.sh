#!/bin/bash
# Wrapper script for mcp-debugger to ensure stdio mode works correctly with Claude Code
# This script ensures the 'stdio' argument is passed when needed

# Check if we're being run by Claude Code (usually no arguments or just transport-related args)
# The MCP SDK typically uses STDIO by default when no transport is specified
if [ $# -eq 0 ] || [[ "$*" != *"--transport"* ]]; then
    # Add stdio argument to ensure console output is suppressed
    exec node "$(dirname "$0")/dist/index.js" stdio "$@"
else
    # Pass through all arguments as-is for other transport modes
    exec node "$(dirname "$0")/dist/index.js" "$@"
fi