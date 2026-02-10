# tests/e2e/mcp-server-smoke-rust.test.ts
@source-hash: 9c3cfdb5282dbf34
@generated: 2026-02-09T18:15:14Z

## Primary Purpose
End-to-end smoke test for Rust debugging via MCP (Model Context Protocol) interface, designed to reproduce and validate Rust debugging functionality locally without relying on manual user sessions.

## Test Structure
**Test Suite:** `MCP Server Rust Debugging Smoke Test` (L19)
- **Global Variables:** mcpClient, transport, sessionId (L20-22) - shared test state
- **Setup:** beforeAll (L24-46) - initializes MCP client and transport connection
- **Cleanup:** afterEach (L48-53) closes debug sessions, afterAll (L55-64) closes client/transport
- **Timeout:** 30s setup, 60s per test (L46, L193, L318)

## Key Test Cases

### Test 1: Basic Rust Debug Session (L66-194)
- **Purpose:** Validates full debugging workflow without proxy exit errors
- **Target:** hello_world Rust example
- **Workflow:**
  1. Prepare Rust binary via `prepareRustExample('hello_world')` (L69-70)
  2. Create debug session with `create_debug_session` tool (L74-81)
  3. Set breakpoint at line 26 using `set_breakpoint` tool (L83-92)
  4. Start debugging with `start_debugging` tool (L94-112)
  5. Fetch stack trace and verify user frame presence (L117-160)
  6. Validate local variables contain expected Rust values (L169-192)

### Test 2: Async Rust Debugging (L196-319)
- **Purpose:** Tests async/await debugging capabilities
- **Target:** async_example Rust binary
- **Key Validations:**
  - Breakpoint at line 46 in async context (L218)
  - Stack frame navigation for async code (L256-285)
  - Local variable inspection in async context (L291-308)

## Core Dependencies
- **MCP SDK:** Client and StdioClientTransport (L11-12)
- **Test Utils:** parseSdkToolResult, callToolSafely (L13)
- **Rust Utils:** prepareRustExample (L14)
- **Test Framework:** vitest (L7)

## Key Patterns
- **Retry Logic:** Stack trace polling with 10 attempts and 300ms delays (L149-155, L274-280)
- **Frame Filtering:** isUserFrame/isAsyncUserFrame functions filter relevant stack frames (L131-135, L256-260)
- **Safe Tool Calls:** Uses parseSdkToolResult wrapper for consistent response handling
- **Session Management:** Automatic cleanup in afterEach prevents session leaks

## Critical Constraints
- **Build Requirement:** Expects dist/index.js to exist (L25-28)
- **Binary Dependencies:** Rust examples must be compiled and accessible
- **Timing Sensitive:** Uses wait() delays for debugger state synchronization (L116, L241)
- **Path Normalization:** Handles Windows/Unix path differences with replace(/\\/g, '/') (L133, L163, L258, L288)

## MCP Tools Used
- `create_debug_session` - Initialize debugging session
- `set_breakpoint` - Set source breakpoints  
- `start_debugging` - Launch debugger with DAP configuration
- `get_stack_trace` - Retrieve call stack
- `get_local_variables` - Inspect variable values
- `continue_execution` - Resume execution
- `close_debug_session` - Clean up session