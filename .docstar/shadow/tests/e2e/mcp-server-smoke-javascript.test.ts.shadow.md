# tests/e2e/mcp-server-smoke-javascript.test.ts
@source-hash: c338a93197059f73
@generated: 2026-02-10T21:25:38Z

**Purpose**: End-to-end smoke tests for JavaScript debugging functionality via MCP (Model Context Protocol) server integration. Validates core debugging workflow without implementation coupling.

## Test Architecture

**Test Suite**: `JavaScript Debugging - Simple Smoke Tests` (L21)
- **Client Setup**: MCP client with StdioClientTransport (L22-24, L36-53)
- **Server Target**: `@debugmcp/mcp-debugger` CLI via Node.js subprocess (L29, L37-38)
- **Test Script**: Uses `examples/javascript/simple_test.js` (L92)

## Key Test Components

**Setup/Teardown** (L26-90):
- `beforeAll` (L26-54): Validates CLI bundle exists, starts MCP server with stdio transport
- `afterAll` (L56-76): Cleanup debug session and close connections
- `afterEach` (L78-90): Per-test session cleanup

**Core Integration Test** (L94-256):
Complete debugging workflow validation:
1. **Session Creation** (L97-110): Creates JavaScript debug session
2. **Breakpoint Setting** (L113-125): Sets breakpoint at line 14
3. **Debug Start** (L128-146): Launches script, expects paused state
4. **Stack Inspection** (L152-165): Retrieves and validates stack frames
5. **Variable Access** (L168-181): Gets local variables (allows empty arrays)
6. **Step Control** (L184-210): Step over execution, validates location/context response
7. **Expression Evaluation** (L213-227): Evaluates `1 + 2`, expects result containing "3"
8. **Continue Execution** (L230-238): Resumes program execution
9. **Session Cleanup** (L244-253): Closes debug session

**Additional Tests**:
- **Multi-breakpoint Test** (L258-295): Sets breakpoints at lines 11 and 14
- **Source Context Test** (L297-340): Retrieves source code context around line 14

## Critical Dependencies

- **MCP SDK**: `@modelcontextprotocol/sdk` for client/transport (L13-14)
- **Utility**: `parseSdkToolResult` from `./smoke-test-utils.js` (L15)
- **Test Framework**: Vitest with 30s/60s timeouts (L9, L54, L256)

## Architecture Notes

- **Transport**: Uses stdio-based communication with Node.js subprocess
- **Error Handling**: Graceful cleanup on session close failures (L63-65, L85-87)
- **Timing**: Strategic delays for session stabilization (L149, L210, L241)
- **Validation Strategy**: Focuses on successful operation rather than exact response formats
- **Environment**: Sets `NODE_ENV=test` for server process (L41)