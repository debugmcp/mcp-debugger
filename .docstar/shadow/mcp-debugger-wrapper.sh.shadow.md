# mcp-debugger-wrapper.sh
@source-hash: 65455119cf7b045d
@generated: 2026-02-10T00:42:00Z

## Primary Purpose
Bash wrapper script for the mcp-debugger Node.js application that automatically handles transport mode detection and ensures proper stdio configuration for Claude Code integration.

## Core Functionality
The script intelligently routes execution based on command-line arguments:
- **Transport Detection Logic (L7)**: Checks if arguments are empty or lack `--transport` flag
- **Stdio Mode Execution (L9)**: Automatically injects `stdio` argument when running without explicit transport
- **Passthrough Mode (L12)**: Preserves original arguments for explicit transport specifications

## Key Components
- **Argument Analysis (L7)**: Uses bash parameter expansion and pattern matching to detect transport mode
- **Execution Delegation (L9, L12)**: Both branches use `exec` to replace shell process with Node.js runtime
- **Path Resolution (L9, L12)**: Dynamically resolves script directory using `$(dirname "$0")` for portable execution

## Architectural Decisions
- **Default Stdio Assumption**: Assumes Claude Code integration requires stdio mode when no transport specified
- **Process Replacement**: Uses `exec` instead of subprocess calls to maintain PID and signal handling
- **Argument Preservation**: Maintains original argument order with `"$@"` expansion

## Dependencies
- Node.js runtime (assumed available in PATH)
- Compiled JavaScript distribution at `./dist/index.js` relative to wrapper location
- MCP SDK stdio transport functionality

## Integration Context
Designed specifically for Claude Code IDE integration where the MCP debugger needs to suppress console output and communicate via stdio transport protocol.