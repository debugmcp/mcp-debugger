# tests/e2e/mcp-server-smoke-rust.test.ts
@source-hash: 9c3cfdb5282dbf34
@generated: 2026-02-10T00:42:00Z

## E2E MCP Server Rust Debugging Smoke Test

End-to-end test suite that validates Rust debugging functionality through the Model Context Protocol (MCP) interface. Designed to reproduce and prevent Rust debugging failures locally instead of relying on manual user testing.

### Core Purpose
- Tests MCP server's ability to debug Rust programs via DAP (Debug Adapter Protocol)
- Validates complete debug workflow: session creation, breakpoint setting, execution control, and variable inspection
- Prevents regression in Rust debugging capabilities

### Test Structure (L19-320)

**Setup & Teardown:**
- `beforeAll` (L24-46): Initializes MCP client connection to debug server via stdio transport
- `afterEach` (L48-53): Cleans up debug sessions after each test
- `afterAll` (L55-64): Closes MCP client and transport connections

**Test Variables (L20-22):**
- `mcpClient`: MCP SDK client for tool calls
- `transport`: Stdio transport for server communication  
- `sessionId`: Active debug session identifier

### Test Cases

**Test 1: Basic Rust Debug Session (L66-194)**
- Prepares `hello_world` Rust example using `prepareRustExample` utility
- Creates debug session, sets breakpoint at line 26
- Starts debugging with `stopOnEntry: true` and `sourceLanguages: ['rust']`
- Validates session doesn't contain "proxy exited" error message
- Uses retry logic with `fetchStackTrace` helper (L117-129) to wait for user frame
- Inspects local variables, expecting `name="Rust"` and `version` containing "1.75"

**Test 2: Async Rust Debug Session (L196-319)**  
- Tests `async_example` Rust program with async/await patterns
- Sets breakpoint at line 46, validates async frame navigation
- Inspects locals expecting `id=1` and `result` containing "Data_1"
- Uses similar retry pattern with `isAsyncUserFrame` filter (L256-260)

### Key Utilities
- `parseSdkToolResult` (L13): Parses MCP tool call responses
- `callToolSafely` (L13): Safe MCP tool invocation wrapper
- `prepareRustExample` (L14): Sets up Rust example projects for testing
- `wait` helpers (L116, L241): Async delay utilities for debugging timing

### MCP Tools Used
- `create_debug_session`: Initialize debug session
- `set_breakpoint`: Set source code breakpoints  
- `start_debugging`: Launch debugger with DAP configuration
- `get_stack_trace`: Retrieve call stack information
- `continue_execution`: Resume program execution
- `get_local_variables`: Inspect variable values
- `close_debug_session`: Clean up session resources

### Architectural Notes
- Uses 30s/60s timeouts for debugging operations due to compilation overhead
- Implements retry mechanisms for timing-sensitive debug state checks
- Validates specific line numbers and variable values to ensure precise debugging accuracy
- Cross-platform path handling with forward slash normalization