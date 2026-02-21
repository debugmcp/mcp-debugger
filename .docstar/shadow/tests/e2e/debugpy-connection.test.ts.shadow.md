# tests\e2e\debugpy-connection.test.ts
@source-hash: 5a3fb0e229785513
@generated: 2026-02-21T08:28:15Z

## Primary Purpose

E2E test file validating MCP server's debugpy integration capabilities. Tests the complete debugging workflow: connecting to debugpy as a DAP client, setting breakpoints, controlling execution, and retrieving runtime data.

## Key Test Infrastructure

**Test Configuration (L1-33)**
- Jest environment configured for Node.js execution
- Timeout set to 60 seconds (`TEST_TIMEOUT = 60000`)
- Global state tracking: `mcpSdkClient`, `debugpyProcess`, `mcpProcess`, `serverPort`

**Cleanup Function (L35-104)**
- Centralized cleanup handling all process termination and resource deallocation
- Closes debug sessions via MCP tools before terminating processes
- Handles graceful shutdown of SDK client, MCP server, and debugpy processes
- Includes 500ms delay for socket cleanup on Windows

**Utility Functions**
- `parseSdkToolResult()` (L107-114): Extracts JSON from MCP ServerResult structure
- `findAvailablePort()` (L119-154): Random port selection with availability testing
- `startDebugpyServer()` (L156-190): Spawns Python debugpy server process
- `startMcpServer()` (L192-199): Launches MCP server in SSE mode

## Test Suite Structure

**Setup (beforeAll, L202-250)**
1. Validates build artifacts exist (`dist/index.js`)
2. Starts debugpy server on random port
3. Starts MCP server with SSE transport
4. Polls `/health` endpoint for readiness
5. Establishes MCP SDK client connection

**Test Cases**
1. **Debug Session Management** (L257-280): Creates, lists, and closes debug sessions
2. **Complete Python Debugging** (L282-418): Full debugging workflow with temporary script

## Key Dependencies

- **MCP SDK**: `@modelcontextprotocol/sdk` for client communication
- **Test Framework**: Vitest for test execution
- **Process Management**: Node.js `child_process` for spawning debugpy/MCP servers
- **File System**: Native Node.js `fs/promises` for temp file handling

## Architecture Patterns

**Process Orchestration**: Manages multiple external processes (debugpy server, MCP server) with proper lifecycle management and cleanup.

**Port Management**: Dynamic port allocation to avoid conflicts in test environments.

**Error Handling**: Defensive programming with comprehensive try-catch blocks and cleanup in finally blocks.

**Async Coordination**: Uses polling and timeouts to synchronize with external processes rather than relying on deterministic startup times.

## Critical Test Invariants

- All debug sessions must be explicitly closed before process termination
- Temporary test files must be cleaned up regardless of test outcome  
- Port availability must be verified before server startup
- Health endpoint must report "ok" status before running tests
- Build artifacts (`dist/index.js`) must exist before test execution

## Platform Considerations

- Python executable selection: `python` on Windows, `python3` on Unix systems (L169)
- Windows-specific socket cleanup delays (L145, L102)
- Cross-platform path handling for test fixtures and temporary files