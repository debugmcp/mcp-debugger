# scripts/test-mcp-integration.sh
@source-hash: ed9d30e761e197ad
@generated: 2026-02-09T18:15:15Z

**Purpose**: Integration test script for MCP (Model Context Protocol) server compliance, validating JSON-RPC protocol implementation and Claude CLI integration.

**Core Architecture**:
- **Test Framework**: Custom bash test runner with colored output and pass/fail counters (L13-22)
- **Test Execution**: `run_test()` function (L24-45) that pipes JSON to Node.js server, validates response patterns
- **Timeout Protection**: 2-second timeouts prevent hanging on unresponsive server calls (L32, L54, L72)

**Key Test Categories**:

1. **Protocol Compliance Tests**:
   - Initialize handshake (L47-50): Validates MCP protocol version negotiation
   - Tools listing (L65-68): Confirms `create_debug_session` tool availability
   - Clean output validation (L52-63): Ensures pure JSON responses without log contamination

2. **Integration Tests**:
   - Auto-detection fallback (L70-79): Tests server behavior without explicit stdio argument
   - Claude CLI integration (L81-94): Validates MCP server registration and connection status

**Critical Dependencies**:
- Node.js server at `$PROJECT_DIR/dist/index.js` (main MCP server executable)
- Python3 for JSON validation (`python3 -m json.tool`)
- Claude CLI at `/home/ubuntu/.claude/local/claude` for integration testing
- Companion installation script at `$PROJECT_DIR/scripts/install-claude-mcp.sh`

**Test Execution Pattern**:
- Each test pipes JSON-RPC requests via stdin to the server process
- Uses grep pattern matching against expected response structures
- Maintains running counters for pass/fail statistics (L20-21, L36, L42)
- Color-coded output (GREEN/RED/YELLOW) for immediate visual feedback

**Exit Behavior**:
- Returns 0 if all tests pass (L110)
- Returns 1 if any test fails (L114)
- Provides summary statistics and next-step guidance on failures

**Notable Patterns**:
- Robust error handling with `set -e` and `|| true` constructs
- Hardcoded paths specific to Ubuntu environment (`/home/ubuntu/.claude/`)
- Mixed validation approaches (pattern matching for protocol, JSON parsing for format)