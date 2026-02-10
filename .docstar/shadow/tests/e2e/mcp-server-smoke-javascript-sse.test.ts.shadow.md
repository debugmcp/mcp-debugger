# tests/e2e/mcp-server-smoke-javascript-sse.test.ts
@source-hash: 9c223250b3965053
@generated: 2026-02-09T18:15:13Z

## Purpose & Responsibility
End-to-end test file validating JavaScript debugging functionality through SSE (Server-Sent Events) transport. Tests the critical console silencing fix for preventing IPC channel corruption in parent-child-grandchild debugging architecture.

## Key Test Scenarios
- **Main JavaScript Debug Test (L431-497)**: Validates complete JavaScript debugging workflow via SSE transport with stack traces and local variables
- **Default Launch Args Test (L499-542)**: Tests debugging without custom launch arguments to ensure default behavior works

## Critical Components

### Server Management Functions
- **`findAvailablePort()` (L107-144)**: Finds available ports by attempting to bind, with retry logic for port conflicts
- **`startSSEServer()` (L154-247)**: Spawns SSE server process with inherited stdio (matching production), includes retry logic and comprehensive error handling
- **`afterEach()` cleanup (L47-102)**: Graceful shutdown with SIGTERM → SIGKILL fallback pattern

### Debug Sequence Execution
- **`executeJavaScriptDebugSequence()` (L260-429)**: Core debugging workflow implementation:
  - Creates debug session for JavaScript
  - Sets breakpoint at line 11 in target script
  - Starts debugging with configurable launch args
  - Polls for stack trace availability with timeout
  - Retrieves local variables
  - Validates presence of stack frames and variables

### Key Configuration
- **Test timeout**: 60 seconds (L38) - extended for JavaScript SSE operations
- **Target script**: `examples/javascript/simple_test.js` with breakpoint at line 11
- **SSE endpoint**: `http://localhost:{port}/sse` (L453)

## Critical Architecture Insight
The test uses `stdio: 'inherit'` (L178) to match production environment behavior. This validates that console silencing in `src/index.ts` prevents IPC channel corruption when SSE server spawns proxy processes. Without proper console silencing (`hasSSE ||` condition), console output corrupts IPC channels causing empty stack traces and 35-second timeouts.

## Dependencies
- **MCP SDK**: `@modelcontextprotocol/sdk/client/index.js` and `/sse.js` for SSE transport
- **Test utilities**: `./smoke-test-utils.js` for `waitForPort()` and `parseSdkToolResult()`
- **Node.js modules**: `child_process`, `net`, `path`, `os` for process management and networking

## Error Patterns
- Port binding failures with EADDRINUSE/EACCES retry logic
- IPC channel corruption symptoms: empty stack traces, 35-second timeouts, no debug adapter response
- Server startup validation through port availability checking

## Test State Management
- Global variables for cleanup: `mcpSdkClient`, `sseServerProcess`, `serverPort` (L40-42)
- Session-scoped cleanup in finally blocks for debug sessions
- Two-phase shutdown: graceful SIGTERM with timeout, then SIGKILL