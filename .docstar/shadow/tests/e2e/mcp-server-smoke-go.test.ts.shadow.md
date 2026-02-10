# tests/e2e/mcp-server-smoke-go.test.ts
@source-hash: e5ecef5a125da1e7
@generated: 2026-02-09T18:15:11Z

## Purpose
End-to-end smoke test for Go debugging adapter integration through MCP (Model Context Protocol) interface. Validates that Go adapter is properly registered, loaded, and functional within the debugging system.

## Key Components

### Test Setup (L31-54)
- **beforeAll**: Initializes MCP server connection using StdioClientTransport with Node.js subprocess
- Connects to `dist/index.js` with test environment configuration
- Creates MCP client with basic capabilities for communication

### Cleanup Handlers (L56-87)
- **afterAll** (L56-75): Closes debug sessions, MCP client, and transport connections
- **afterEach** (L77-87): Ensures session cleanup between tests to prevent state leakage

### Core Test Cases

#### Session Creation Test (L89-107)
- Validates `create_debug_session` with `language: 'go'` parameter
- Tests adapter loading through AdapterLoader integration
- Confirms sessionId generation and basic session establishment

#### Adapter Discovery Test (L109-132) 
- Attempts to call `list_adapters` tool to verify Go adapter registration
- Gracefully handles missing tool (expected in some configurations)
- Validates adapter-loader.ts integration points

#### Full Debug Flow Test (L134-253)
- **Environment Check** (L136-157): Validates Go compiler and Delve debugger availability
- **Binary Compilation** (L159-172): Builds test Go program with debug symbols (`-gcflags="all=-N -l"`)
- **Debug Session Workflow**:
  - Creates session (L175-188)
  - Sets breakpoint at line 12 of Go source (L190-202)
  - Starts debugging in exec mode with compiled binary (L204-221)
  - Retrieves stack trace to validate debugging state (L226-233)
  - Continues execution to completion (L235-240)
- **Cleanup**: Removes compiled test binary (L242-252)

## Dependencies
- **MCP SDK**: Client and StdioClientTransport for protocol communication
- **Vitest**: Test framework with async/await support
- **smoke-test-utils.js**: Utilities for parsing tool results and safe tool calls
- **Child Process**: For Go/Delve availability checks and compilation

## Test Patterns
- Uses `@requires-go` tag for conditional test execution
- Implements defensive programming with try-catch blocks for optional operations
- Employs timeouts for asynchronous debugging operations (2-second waits)
- Graceful degradation when Go toolchain unavailable

## Critical Paths Tested
- Adapter registration in dependencies.ts
- AdapterLoader.loadAdapter('go') functionality  
- Delve debugger integration through DAP protocol
- MCP tool interface for debugging operations

## Test Data
- Uses `examples/go/hello_world.go` as test subject
- Targets line 12 for breakpoint placement
- Compiles to `hello_world_test` binary for exec debugging