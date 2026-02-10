# mcp-debugger-wrapper.sh
@source-hash: 65455119cf7b045d
@generated: 2026-02-09T18:15:15Z

**Purpose**: Bash wrapper script that intelligently routes MCP debugger execution to ensure proper stdio mode handling for Claude Code integration.

**Core Logic**:
- **Transport Detection (L7)**: Conditionally checks if script is invoked without arguments or without explicit `--transport` parameter
- **Stdio Mode Routing (L9)**: When no transport specified, executes Node.js with forced `stdio` argument to suppress console output for Claude Code compatibility
- **Passthrough Mode (L12)**: For explicit transport specifications, passes all arguments unchanged to the underlying Node.js application

**Key Components**:
- **Script Path Resolution (L9, L12)**: Uses `$(dirname "$0")/dist/index.js` to locate the main Node.js entry point relative to wrapper location
- **Argument Handling (L9, L12)**: Preserves original arguments with `"$@"` while conditionally prepending `stdio`
- **Process Replacement (L9, L12)**: Uses `exec` to replace shell process with Node.js, ensuring clean process hierarchy

**Dependencies**:
- Requires Node.js runtime in PATH
- Expects compiled JavaScript at `dist/index.js` relative to script location
- Designed for MCP (Model Context Protocol) SDK integration patterns

**Architectural Decisions**:
- **Default Stdio Assumption**: Aligns with MCP SDK convention of defaulting to stdio transport when unspecified
- **Claude Code Compatibility**: Specifically addresses console output suppression needs for IDE integration
- **Transparent Wrapping**: Maintains full argument compatibility while adding intelligent defaults

**Critical Constraints**:
- Transport detection relies on string pattern matching for `--transport` parameter
- Assumes `dist/index.js` exists and is executable via Node.js
- Process replacement semantics require proper exit code propagation through `exec`