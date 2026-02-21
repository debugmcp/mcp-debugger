# tests\e2e\mcp-server-smoke-go.test.ts
@source-hash: 902a755f75dfee1e
@generated: 2026-02-21T20:48:07Z

**Purpose**: End-to-end smoke test for Go debugging functionality via MCP (Model Context Protocol) interface. Validates that the Go adapter can be loaded, debug sessions created, and core debugging features work through the MCP server.

**Key Test Structure**:
- Test suite tagged with `@requires-go` (L26) indicating Go runtime dependency
- Three main test cases covering adapter registration, listing, and full debugging flow
- Uses Vitest framework with setup/teardown hooks

**Setup & Teardown**:
- `beforeAll` (L31-54): Spawns MCP server process via StdioClientTransport, connects MCP client with 30s timeout
- `afterAll` (L56-75): Cleans up debug session and closes client/transport connections  
- `afterEach` (L77-87): Ensures session cleanup between tests

**Test Cases**:

1. **Basic Session Creation** (L89-107):
   - Tests `create_debug_session` MCP tool with `language: 'go'`
   - Validates Go adapter registration in dependencies.ts
   - Verifies sessionId returned and stored

2. **Adapter Listing** (L109-132):  
   - Tests optional `list_adapters` MCP tool
   - Gracefully handles tool not existing
   - Validates Go adapter appears in available adapters list

3. **Full Debugging Flow** (L134-253):
   - Runtime checks for Go compiler and Delve debugger availability
   - Compiles test Go binary with debug symbols (`go build -gcflags="all=-N -l"`)
   - Executes complete debugging workflow:
     - Creates debug session
     - Sets breakpoint on test file (L196-198)
     - Starts debugging in 'exec' mode with pre-compiled binary
     - Retrieves stack trace
     - Continues execution
   - 60s timeout for Go compilation and Delve startup
   - Cleanup of compiled test binary

**Dependencies**:
- MCP SDK client libraries for transport and communication
- Test utilities from `./smoke-test-utils.js` for safe tool calls
- Child process execution for Go/Delve availability checks
- File system operations for test binary management

**Key Integration Points Tested**:
- AdapterLoader.loadAdapter('go') functionality
- MCP tool registration and execution
- Delve debugger integration through DAP (Debug Adapter Protocol)
- Go-specific debugging features (exec mode, stack traces)

**Test Data**:
- Uses example Go file at `examples/go/hello_world.go`
- Breakpoint set at line 12 (inside main function)
- Compiled binary output to `examples/go/hello_world_test`