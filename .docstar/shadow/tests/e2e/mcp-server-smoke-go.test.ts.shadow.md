# tests/e2e/mcp-server-smoke-go.test.ts
@source-hash: e5ecef5a125da1e7
@generated: 2026-02-10T00:41:58Z

## Purpose
E2E smoke test for Go debugging adapter integration through MCP (Model Context Protocol) interface. Validates that the Go adapter can be loaded, sessions created, and core debugging operations performed via MCP tools.

## Key Test Structure
- **Test Suite (L26)**: `@requires-go` tagged test suite for Go debugging functionality
- **Setup/Teardown (L31-87)**: MCP client lifecycle management with proper cleanup
- **Three Core Tests (L89-253)**: Session creation, adapter listing, and full debugging flow

## MCP Client Management
- **Client Creation (L44-53)**: Creates MCP client connecting to `dist/index.js` with stdio transport
- **Session Tracking (L27-29)**: Maintains `mcpClient`, `transport`, and `sessionId` state
- **Cleanup Strategy (L56-87)**: Proper teardown in `afterAll` and `afterEach` hooks

## Test Cases

### Session Creation Test (L89-107)
- Validates Go adapter registration through `create_debug_session` MCP tool
- Uses `language: 'go'` parameter to trigger adapter loading
- Confirms integration with AdapterLoader system

### Adapter Listing Test (L109-132)
- Optional test for `list_adapters` MCP tool (gracefully handles missing tool)
- Verifies Go adapter appears in available adapters list
- Tests adapter-loader.ts integration points

### Full Debugging Flow Test (L134-253)
- **Environment Check (L136-157)**: Validates Go and Delve availability
- **Binary Compilation (L159-172)**: Compiles test Go program with debug symbols
- **Debug Operations (L174-241)**:
  - Creates debug session
  - Sets breakpoint at line 12
  - Starts debugging in `exec` mode with pre-compiled binary
  - Retrieves stack trace
  - Continues execution
- **Cleanup (L242-253)**: Removes test binary

## Dependencies
- **MCP SDK (L18-19)**: Client and StdioClientTransport for MCP communication
- **Test Utilities (L20)**: `parseSdkToolResult` and `callToolSafely` helpers
- **Go Toolchain**: Runtime dependency on `go` and `dlv` commands

## Key Integration Points
- Tests actual MCP tool calls: `create_debug_session`, `set_breakpoint`, `start_debugging`, `get_stack_trace`, `continue_execution`
- Validates Go adapter can be loaded through `AdapterLoader.loadAdapter('go')`
- Uses compiled binary debugging approach with Delve's exec mode

## Test Configuration
- 30-second timeout for setup (L54)
- 2-second waits for debugging operations (L224, L240)
- Graceful degradation when Go/Delve unavailable
- Test binary path: `examples/go/hello_world.go` → `hello_world_test`