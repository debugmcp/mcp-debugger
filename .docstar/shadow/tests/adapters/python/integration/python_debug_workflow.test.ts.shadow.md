# tests/adapters/python/integration/python_debug_workflow.test.ts
@source-hash: 0c6700a12af6e05b
@generated: 2026-02-11T20:15:05Z

## Purpose
Integration test suite for the Python debugging workflow using the MCP (Model Context Protocol) client to test debug adapter functionality. Tests full debug session lifecycle including breakpoints, stack inspection, and variable examination.

## Key Components

### Test Client Setup (L14-85)
- `client` (L14): Global MCP Client instance for communicating with debug server
- `startTestServer()` (L17-72): Initializes MCP client with StdioClientTransport, spawns debug server process at `../../../../dist/index.js`, configures logging and environment
- `stopTestServer()` (L74-85): Cleanly closes client connection and server process

### Utility Functions (L87-125)
- `delay()` (L88): Promise-based timeout utility
- `parseToolResult()` (L90-97): Extracts and parses JSON content from MCP ServerResult responses
- `waitForStackFrames()` (L99-125): Polling mechanism to wait for stack frames to be available during debugging, with configurable timeout and retry interval

### Main Test Suite (L127-286)
**"Python Debugging Workflow - Integration Test @requires-python"**

#### Full Debug Session Test (L140-234)
Tests complete debugging workflow:
1. Lists existing debug sessions
2. Creates new Python debug session 
3. Sets breakpoint at line 13 in `debug_test_simple.py` 
4. Starts debugging with `stopOnEntry: true`
5. Continues execution to breakpoint
6. Inspects stack frames and verifies location
7. Retrieves scopes (specifically "Locals" scope)
8. Examines local variables `a` and `b` with expected values (5, 10)
9. Closes debug session

#### Dry Run Test (L236-285)
Tests dry run functionality for `start_debugging`:
- Creates separate session for dry run
- Calls `start_debugging` with `dryRunSpawn: true`
- Verifies dry run response structure and state
- Includes CI-specific error logging and failure payload persistence

### Error Handling & Debugging
- `persistFailurePayload()` (L287-297): Saves failure payloads to `logs/tests/adapters/failures/` for CI debugging
- Extensive console logging throughout test execution
- CI-specific environment variable checks and enhanced error reporting

## Dependencies
- **Vitest**: Test framework
- **@debugmcp/shared**: Debug protocol types (DebugSessionInfo, StackFrame, Variable)
- **@vscode/debugprotocol**: VS Code Debug Adapter Protocol definitions
- **@modelcontextprotocol/sdk**: MCP client SDK for server communication
- **env-utils.js**: Python environment setup utility

## Test Configuration
- Target script: `tests/fixtures/python/debug_test_simple.py`
- Breakpoint location: Line 13 (`c = a + b`)
- Timeouts: 30s beforeAll, 60s suite, 15s stack frame polling
- Requires Python runtime (tagged with `@requires-python`)

## Architecture Notes
- Uses MCP protocol for debug adapter communication instead of direct DAP
- Employs polling strategy for asynchronous debug state changes
- Separates transport layer (StdioClientTransport) from client logic
- Server process lifecycle managed by MCP transport layer