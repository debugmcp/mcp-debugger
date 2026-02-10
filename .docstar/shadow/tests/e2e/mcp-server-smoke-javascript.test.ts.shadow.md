# tests/e2e/mcp-server-smoke-javascript.test.ts
@source-hash: 0692a51e836a4311
@generated: 2026-02-10T00:42:02Z

## Purpose
End-to-end smoke test suite for JavaScript debugging functionality via MCP (Model Context Protocol) server. Validates core debugging operations without implementation coupling to ensure functionality survives refactoring.

## Test Environment Setup
- **Test Framework**: Vitest with async beforeAll/afterAll/afterEach hooks (L9, L26-90)
- **MCP Client Setup**: Uses StdioClientTransport to communicate with mcp-debugger CLI (L36-53)
- **Target Script**: Tests against `examples/javascript/simple_test.js` (L92)
- **Session Management**: Tracks sessionId for proper cleanup between tests (L24, L78-90)

## Key Test Cases

### Full Debugging Cycle Test (L94-256)
Comprehensive workflow validation covering:
1. **Session Creation** (L98-109): Creates debug session and validates sessionId
2. **Breakpoint Setting** (L114-125): Sets breakpoint at line 14 and verifies acceptance
3. **Debug Start** (L129-146): Launches debugging with DAP args, expects paused state
4. **Stack Trace** (L153-165): Retrieves and validates stack frame structure
5. **Variable Access** (L169-181): Gets local variables (may be empty but mechanism works)
6. **Step Execution** (L185-210): Steps over and validates location/context response
7. **Expression Evaluation** (L214-227): Evaluates "1 + 2", expects result containing "3"
8. **Execution Control** (L231-238): Continues execution to completion
9. **Session Cleanup** (L244-253): Properly closes debug session

### Multiple Breakpoints Test (L258-295)
Validates setting multiple breakpoints (lines 11 and 14) in single session.

### Source Context Test (L297-340)
Tests source code retrieval with context lines around target line 14.

## Dependencies
- **MCP SDK**: Client and StdioClientTransport for server communication (L13-14)
- **Smoke Test Utils**: parseSdkToolResult helper for response parsing (L15)
- **Node.js**: File system and path utilities for script location (L10-12)

## Architecture Patterns
- **Resilient Testing**: Focuses on behavioral validation rather than implementation details
- **Resource Management**: Proper cleanup in afterEach/afterAll with error handling (L78-90)
- **CLI Validation**: Ensures mcp-debugger CLI bundle exists before testing (L29-34)
- **Timeout Handling**: 30s setup timeout, 60s test timeout for stability (L54, L256)

## Critical Invariants
- Sessions must be properly closed to prevent resource leaks
- Test waits (1-2s) allow async operations to stabilize
- All tool calls go through parseSdkToolResult for consistent response handling
- Tests expect specific tool response formats (success flags, sessionId, etc.)