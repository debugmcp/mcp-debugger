# tests/adapters/python/integration/python_debug_workflow.test.ts
@source-hash: 7ae57dde2e2c5068
@generated: 2026-02-10T21:25:37Z

## Python Debug Workflow Integration Test

**Purpose:** Comprehensive integration test for Python debugging workflow through MCP (Model Context Protocol) client, validating full debug session lifecycle including breakpoints, stack inspection, and variable access.

### Key Components

**Test Server Management (L17-85)**
- `startTestServer()` (L17-72): Spawns MCP server via SDK StdioClientTransport, handles environment setup, Python path validation, and log file management
- `stopTestServer()` (L74-85): Cleanly shuts down MCP client connection and server process
- Uses `dist/index.js` as server executable path with debug logging enabled

**Test Infrastructure**
- `parseToolResult()` (L90-97): Extracts JSON content from MCP ServerResult responses, validates structure
- `waitForStackFrames()` (L99-125): Polling utility for stack frame availability with configurable timeout/intervals
- `delay()` (L88): Simple promise-based delay helper
- `persistFailurePayload()` (L287-297): CI failure debugging utility that saves error payloads to filesystem

### Test Cases

**Main Debug Workflow Test (L140-234)**
1. **Session Management**: Creates debug session, lists existing sessions
2. **Breakpoint Setup**: Sets breakpoint at line 13 of `debug_test_simple.py` 
3. **Debug Execution**: Starts debugging with stopOnEntry, continues to breakpoint
4. **Stack Inspection**: Retrieves and validates stack frames, focuses on `sample_function`
5. **Scope Analysis**: Gets scopes for top frame, locates 'Locals' scope
6. **Variable Inspection**: Validates local variables `a=5` and `b=10` with correct types
7. **Cleanup**: Closes debug session properly

**Dry Run Test (L236-285)**
- Tests `start_debugging` with `dryRunSpawn: true` flag
- Validates command logging without actual process execution
- Verifies session state transitions and dry run response structure

### Dependencies & Configuration

**Key Imports:**
- `@debugmcp/shared`: Core debugging types (DebugSessionInfo, StackFrame, Variable)
- `@vscode/debugprotocol`: VS Code debug adapter protocol types
- `@modelcontextprotocol/sdk`: MCP client SDK for server communication
- `./env-utils.js`: Python environment validation utilities

**Test Configuration:**
- Target script: `tests/fixtures/python/debug_test_simple.py`
- Breakpoint line: 13 (`c = a + b` statement)
- Server log: `integration_test_server.log`
- Timeout: 60s for entire suite, 30s for setup

### Architecture Notes

- Uses SDK-based MCP client instead of raw WebSocket/stdio connections
- Implements polling pattern for async debug state changes
- Handles CI-specific logging and failure persistence
- Environment filtering ensures clean subprocess spawning
- Absolute path resolution prevents file location issues