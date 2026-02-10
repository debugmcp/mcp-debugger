# tests/e2e/debugpy-connection.test.ts
@source-hash: 71a8d0b63de5ca48
@generated: 2026-02-09T18:15:18Z

## End-to-End Debug Protocol Integration Test

**Primary Purpose**: Comprehensive E2E test validating MCP (Model Context Protocol) server's ability to act as a DAP (Debug Adapter Protocol) client, connecting to debugpy servers and controlling Python debugging sessions.

### Test Architecture & Setup (L28-33)
- **Test Environment**: Vitest with Node.js environment, 60-second timeout
- **Process Management**: Manages three concurrent processes:
  - `debugpyProcess`: Python debugpy server instance
  - `mcpProcess`: MCP server running in SSE mode  
  - `mcpSdkClient`: MCP SDK client for tool invocation
- **Port Management**: Dynamic port allocation using `findAvailablePort()` (L119-154)

### Key Infrastructure Functions

**Cleanup System (L35-104)**:
- Centralized cleanup function handling graceful shutdown sequence
- Closes debug sessions → SDK client → MCP process → debugpy process
- Includes socket release delays for proper teardown

**debugpy Server Management (L156-190)**:
- `startDebugpyServer()`: Spawns Python debugpy server using platform-specific Python executable
- Cross-platform compatibility (python vs python3)
- Uses fixture script at `tests/fixtures/python/debugpy_server.py`
- Waits for "Debugpy server is listening!" confirmation

**MCP Server Management (L192-199)**:
- `startMcpServer()`: Launches MCP server in SSE mode with debug logging
- Health endpoint polling for readiness verification (L214-238)

**SDK Result Parsing (L107-114, L257-264)**:
- `parseSdkToolResult()`: Extracts JSON content from MCP ServerResult wrapper
- Handles MCP SDK's content array structure

### Test Cases

**Session Lifecycle Test (L266-289)**:
- Creates Python debug session via `create_debug_session` tool
- Validates session appears in `list_debug_sessions`
- Cleans up with `close_debug_session`

**Full Debug Workflow Test (L291-448)**:
- **Script Generation**: Creates temporary Python script with fibonacci function
- **Debug Session Flow**:
  - Creates session and starts debugging with `stopOnEntry: true`
  - Sets breakpoint at line 4 (after sleep statement)
  - Continues execution from entry point
  - Waits for breakpoint hit and validates stack trace
  - Performs step over and continue operations
- **Validation Points**: Stack frame location, file paths, line numbers
- **Cleanup**: Removes temporary files and closes debug session

### Critical Dependencies
- **MCP SDK**: Client/transport layer for tool invocation
- **Node.js Process Management**: spawn, kill, stdio handling  
- **Network Testing**: Port availability checking, health polling
- **File System**: Temporary script creation/cleanup
- **Python Environment**: Cross-platform Python executable detection

### Debugging Features Tested
- Debug session CRUD operations
- Breakpoint setting and hit detection  
- Execution control (continue, step over)
- Stack trace inspection
- Multi-process coordination and cleanup

### Error Handling Patterns
- Timeout-based process startup validation
- Comprehensive cleanup on test failure
- Cross-platform executable resolution
- Network connectivity polling with retries