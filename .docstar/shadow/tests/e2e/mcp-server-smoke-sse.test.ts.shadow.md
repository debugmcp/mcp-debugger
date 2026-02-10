# tests/e2e/mcp-server-smoke-sse.test.ts
@source-hash: 21a53b79b87f18c6
@generated: 2026-02-10T00:42:02Z

## Primary Purpose

End-to-end smoke test for the MCP (Model Context Protocol) server's SSE (Server-Sent Events) transport functionality. Tests server startup, client connection, and debug session execution via HTTP/SSE transport.

## Key Variables & Constants

- `mcpSdkClient` (L21): Global Client instance for MCP SDK connection
- `sseServerProcess` (L22): Node.js ChildProcess for the spawned SSE server
- `serverPort` (L23): Dynamically allocated port number for server binding
- `TEST_TIMEOUT` (L19): 30-second timeout for all test operations
- `distReady` (L25): Build state flag to avoid redundant dist builds

## Core Functions

### `ensureDistBuild()` (L86-100)
Ensures the `dist/index.js` build artifact exists before server startup. Executes `pnpm build` if missing. Uses caching via `distReady` flag.

### `findAvailablePort()` (L105-142) 
Port allocation utility that randomly selects from ephemeral range (49152-65535) and validates availability through socket binding. Implements retry logic with 10 attempts maximum.

### `startSSEServer()` (L147-266)
Complex server lifecycle management:
- Spawns Node.js process running `dist/index.js sse -p <port> --log-level debug`
- Implements graceful startup detection via port polling
- Comprehensive error handling for EACCES, EADDRINUSE
- Multi-attempt retry logic (default 3 retries)
- Captures stdout/stderr for debugging failed startups
- Returns resolved port number on success

## Test Cases

### Primary SSE Test (L268-325)
Standard flow test:
1. Spawns SSE server from project root
2. Health checks via `waitForPort()`
3. Creates MCP Client with SSEClientTransport
4. Executes `executeDebugSequence()` on `fibonacci.py`
5. Graceful cleanup of debug session

### Working Directory Test (L328-396)
Robustness test spawning server from `os.tmpdir()` to verify path resolution independence. Same flow as primary test but with different `cwd`.

## Cleanup Strategy

### `afterEach()` (L29-84)
Comprehensive teardown:
- Closes MCP client connections
- Graceful server shutdown (SIGTERM → wait 2s → SIGKILL if needed)
- 1-second cooldown for resource release
- Resets all global state variables

## Dependencies

- **MCP SDK**: `@modelcontextprotocol/sdk` for Client and SSEClientTransport
- **Test Utils**: `executeDebugSequence()` and `waitForPort()` from local smoke-test-utils
- **Node.js Built-ins**: child_process, net, fs, path, os for system interaction

## Critical Patterns

- **Port Conflict Resolution**: Dynamic port allocation with retry logic
- **Process Management**: Proper signal handling and resource cleanup
- **Async State Management**: Global variables with proper cleanup in afterEach
- **Error Aggregation**: Comprehensive stdout/stderr capture for debugging
- **Timeout Handling**: 30-second global timeout with early resolution on success