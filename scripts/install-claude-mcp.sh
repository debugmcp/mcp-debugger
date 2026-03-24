#!/bin/bash
# Script to install mcp-debugger as an MCP server for Claude Code
# This handles all the configuration details automatically

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Installing mcp-debugger for Claude Code..."
echo "Project directory: $PROJECT_DIR"

# Detect Claude CLI location
CLAUDE_CLI=$(command -v claude 2>/dev/null || echo "")
if [ -z "$CLAUDE_CLI" ]; then
    echo "Error: Claude CLI not found on PATH"
    echo "Please ensure Claude Code is installed first."
    exit 1
fi

# Build the project
echo "Building mcp-debugger..."
cd "$PROJECT_DIR"
npm install
npm run build

# Remove any existing configuration
echo "Removing any existing mcp-debugger configuration..."
$CLAUDE_CLI mcp remove mcp-debugger 2>/dev/null || true

# Add the MCP server with proper configuration
echo "Adding mcp-debugger to Claude Code..."
$CLAUDE_CLI mcp add-json mcp-debugger \
  "{\"type\":\"stdio\",\"command\":\"node\",\"args\":[\"$PROJECT_DIR/dist/index.js\",\"stdio\"],\"env\":{}}"

# Verify the configuration
echo "Verifying installation..."
sleep 1
if $CLAUDE_CLI mcp list | grep -q "mcp-debugger.*✓ Connected"; then
    echo "✅ Success! mcp-debugger is connected and ready to use."
    echo ""
    echo "Available debugging languages:"
    echo "  - Python (requires: pip install debugpy)"
    echo "  - JavaScript/TypeScript (requires: Node.js 18+)"
    echo "  - Rust (requires: Rust toolchain)"
    echo "  - Go (requires: Go 1.18+ and Delve)"
    echo "  - Java (requires: JDK 11+)"
    echo "  - .NET/C# (requires: .NET 6+ SDK and netcoredbg)"
    echo "  - Mock (for testing)"
    echo ""
    echo "To use the debugger in Claude Code:"
    echo "  1. Restart Claude Code if it's currently running"
    echo "  2. The MCP tools will be available with prefix 'mcp__mcp-debugger__'"
    echo ""
    echo "Example tools:"
    echo "  - mcp__mcp-debugger__create_debug_session"
    echo "  - mcp__mcp-debugger__set_breakpoint"
    echo "  - mcp__mcp-debugger__start_debugging"
    echo ""
    echo "For more information, see: $PROJECT_DIR/CLAUDE.md"
else
    echo "⚠️  Warning: mcp-debugger was configured but shows as not connected."
    echo "This is normal if Claude Code is currently running."
    echo ""
    echo "Next steps:"
    echo "  1. Restart Claude Code for the changes to take effect"
    echo "  2. Run '$CLAUDE_CLI mcp list' to verify connection"
    echo ""
    echo "If connection still fails after restart, check:"
    echo "  - $PROJECT_DIR/docs/MCP_CLAUDE_CODE_INTEGRATION.md for troubleshooting"
fi