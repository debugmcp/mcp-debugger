# tests/adapters/python/integration/python_debug_workflow.test.ts
@source-hash: 84d12534a612e431
@generated: 2026-02-10T01:19:06Z

## Purpose
Integration test file for Python debugging workflow using the MCP (Model Context Protocol) SDK. Tests end-to-end debugging functionality including session management, breakpoints, stack traces, and variable inspection through a debug server.

## Key Components

### Test Infrastructure (L13-85)
- `startTestServer()` (L17-72): Spawns MCP debug server as child process using StdioClientTransport, handles environment setup, and manages server logs
- `stopTestServer()` (L74-85): Cleanly shuts down MCP client and server
- `client` (L14): Global MCP Client instance for communication with debug server

### Utility Functions (L87-125)
- `parseToolResult()` (L90-97): Extracts JSON content from MCP ServerResult responses, expects text content type
- `waitForStackFrames()` (L99-125): Polls for stack trace availability with configurable timeout (15s default), handles async debugging state changes
- `delay()` (L88): Simple promise-based sleep utility

### Main Test Suite (L127-286)
**Complete Debug Session Test (L140-234):**
- Creates Python debug session for `debug_test_simple.py`
- Sets breakpoint at line 13 (`c = a + b`)
- Starts debugging with stopOnEntry, continues to breakpoint
- Inspects stack frames, scopes, and local variables (a=5, b=10)
- Validates debugger state transitions and data integrity

**Dry Run Test (L236-285):**
- Tests `start_debugging` with `dryRunSpawn: true` flag
- Validates command logging without actual process execution
- Expects state='stopped' and dryRun=true in response

### Error Handling (L287-297)
- `persistFailurePayload()` (L287-297): Saves test failure data to filesystem for CI debugging, creates timestamped JSON files in `logs/tests/adapters/failures/`

## Dependencies
- Vitest testing framework for test structure and assertions
- MCP SDK (`@modelcontextprotocol/sdk`) for client-server communication
- Debug protocol types from `@debugmcp/shared` and `@vscode/debugprotocol`
- Node.js child_process for server spawning
- Custom `env-utils.js` for Python path configuration

## Test Configuration
- Requires Python runtime (tagged `@requires-python`)
- 60-second suite timeout for debugging operations
- 30-second beforeAll timeout for server startup
- Uses absolute paths for test fixtures (`tests/fixtures/python/debug_test_simple.py`)

## Architecture Notes
- Uses MCP protocol for debugger communication rather than direct DAP
- Implements polling-based synchronization for async debugging events
- Environment filtering ensures clean child process execution
- Supports CI-specific error persistence and logging