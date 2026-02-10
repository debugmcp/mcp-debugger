# tests/e2e/mcp-server-smoke-python.test.ts
@source-hash: 7818a756c57c1676
@generated: 2026-02-10T21:26:00Z

## Python MCP Debugging Smoke Test Suite

**Purpose**: End-to-end test suite for Python debugging capabilities through MCP (Model Context Protocol) interface. Validates Python-specific debugging behaviors and characteristics against a live MCP server.

### Key Test Setup (L24-85)
- **Client Management**: Creates MCP client with StdioClientTransport connecting to debugging server
- **Session Lifecycle**: Manages debug session creation/cleanup with proper teardown in afterEach/afterAll
- **Python Path Handling**: Uses absolute paths for script execution (Python requirement, L89)

### Core Test Cases

#### Primary Integration Test (L87-243)
Tests complete Python debugging workflow:
- Session creation with language-specific configuration (L93-104)
- Breakpoint setting with unverified status handling (L108-123)
- Debug launch with DAP arguments (L126-141) 
- Stack trace validation expecting clean frames (L147-162)
- Variable scope inspection (Locals/Globals scopes, L164-196)
- Step operations with location/context verification (L198-228)
- Session cleanup (L236-241)

#### Multi-Breakpoint Test (L245-289)
Validates setting multiple breakpoints with proper acceptance despite unverified status.

#### Expression Evaluation Test (L291-349)
Tests Python-specific evaluation constraints:
- Expression-only evaluation support (L324-332)
- Statement rejection validation (L336-344)
- Uses stopOnEntry launch mode (L314)

#### Source Context Test (L351-385)
Validates source file context retrieval with line-based queries.

#### Step-Into Test (L387-453)
Tests stepping into function calls with stack depth validation.

### Python-Specific Behaviors Tested
- **Unverified Breakpoints**: Initial breakpoint status is false but functionality works (L119-122)
- **Clean Stack Traces**: Expects fewer than 10 frames without internal runtime frames (L154)
- **Stable References**: Variable references don't require refresh after stepping (L221-227)
- **Absolute Paths Required**: Script paths must be absolute for execution (L89, L130)
- **Expression-Only Eval**: Statements like assignments should fail (L334-344)

### Dependencies
- **Test Framework**: Vitest for test execution and assertions
- **MCP SDK**: Client and StdioClientTransport from @modelcontextprotocol/sdk
- **Utilities**: parseSdkToolResult and callToolSafely from smoke-test-utils.js (L18)
- **Test Script**: Expects examples/python/test_python_debug.py in project root

### Architecture Notes
- Uses 30s/60s timeouts for integration test stability
- Implements defensive error handling for session cleanup
- Console logging provides detailed execution tracing
- Validates both success conditions and expected failure modes