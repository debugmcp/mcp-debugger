# tests/e2e/mcp-server-smoke-rust.test.ts
@source-hash: 8c40b26f8826fee3
@generated: 2026-02-10T21:25:36Z

**Purpose**: E2E smoke test suite for Rust debugging functionality through MCP (Model Context Protocol) interface. Validates that Rust debugging sessions can be created, breakpoints set, and variables inspected without proxy failures.

**Test Structure**: 
- Test suite (L19): "MCP Server Rust Debugging Smoke Test" 
- Setup/teardown (L24-64): Initializes MCP client with StdioClientTransport, connects to debug server at `dist/index.js`
- Session cleanup (L48-53): Ensures debug sessions are properly closed after each test

**Key Test Cases**:
1. **Basic Rust debugging workflow** (L66-194):
   - Uses `hello_world` Rust example via `prepareRustExample()` (L69-70)
   - Creates debug session, sets breakpoint at line 26 (L74-92)
   - Starts debugging with `stopOnEntry: true` (L94-107)
   - Validates no "proxy exited" errors (L114)
   - Implements retry logic to reach user code frames (L140-156)
   - Inspects local variables, expects `name="Rust"` and version containing "1.75" (L169-191)

2. **Async/await debugging** (L196-319):
   - Uses `async_example` Rust project (L199-200)
   - Sets breakpoint at line 46 in async code (L213-222)
   - Validates async stack frame inspection (L256-289)
   - Checks async-specific local variables like `id=1` and `result` containing "Data_1" (L291-308)

**Key Dependencies**:
- MCP SDK client libraries (L11-12) for protocol communication
- Custom utilities: `parseSdkToolResult`, `callToolSafely` (L13)
- `prepareRustExample` (L14) for Rust project setup
- Vitest testing framework (L7)

**Critical MCP Tool Operations**:
- `create_debug_session`: Initializes Rust debugging context
- `set_breakpoint`: Places breakpoints in source files  
- `start_debugging`: Launches debug process with DAP configuration
- `get_stack_trace`: Retrieves call stack with user code filtering
- `continue_execution`: Resumes program execution
- `get_local_variables`: Inspects variable state
- `close_debug_session`: Cleanup utility

**Architectural Patterns**:
- Retry logic with timeout for async debugging states (L149-155, L274-280)
- User code frame filtering to distinguish from runtime internals (L131-135, L256-260)
- Path normalization for cross-platform compatibility (L133, L258)
- Graceful error handling with detailed failure context (L110-112, L158-160)
- Timeout configuration: 30s setup, 60s per test (L46, L193, L318)