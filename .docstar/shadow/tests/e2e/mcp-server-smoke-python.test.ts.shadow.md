# tests/e2e/mcp-server-smoke-python.test.ts
@source-hash: 303eef5e96fc8799
@generated: 2026-02-10T00:42:05Z

## Purpose

End-to-end smoke test suite for Python debugging functionality via MCP (Model Context Protocol) interface. Tests the complete Python debugging workflow through the MCP server, validating actual behavior and known Python-specific characteristics.

## Key Components

### Test Setup (L24-85)
- **Test Suite**: `MCP Server Python Debugging Smoke Test` (L24)
- **Global State**: mcpClient, transport, sessionId variables (L25-27)
- **beforeAll** (L29-52): Initializes MCP server connection via StdioClientTransport
- **afterAll** (L54-73): Cleanup with session closure and connection teardown
- **afterEach** (L75-85): Per-test session cleanup to prevent state leakage

### Core Test Cases

#### Main Debugging Flow (L87-243)
Complete Python debugging workflow test:
- Creates debug session with language: 'python' (L93-104)
- Sets breakpoint at line 32 using absolute script path (L108-123)
- Starts debugging with DAP launch arguments (L126-142)
- Validates stack trace characteristics (L147-162)
- Tests scopes and variables retrieval (L164-196)
- Performs step operations and verifies stable references (L198-228)
- Continues execution and closes session (L230-242)

#### Multiple Breakpoints (L245-289)
Tests setting multiple breakpoints in same Python session

#### Expression Evaluation (L291-349)
Tests Python-specific evaluation constraints:
- Validates expression evaluation works (L324-332)
- Confirms statements are rejected (L336-344)

#### Source Context (L351-385)
Tests source code context retrieval for Python files

#### Step Into (L387-453)
Tests step into functionality for Python function calls

## Key Dependencies

- **Vitest**: Test framework (L13)
- **MCP SDK**: Client and StdioClientTransport from @modelcontextprotocol/sdk (L16-17)
- **Utilities**: parseSdkToolResult, callToolSafely from smoke-test-utils (L18)
- **File System**: path, fileURLToPath for script path resolution (L14-15, L20-22)

## Python-Specific Characteristics Tested

1. **Absolute Paths Required**: Uses `path.resolve()` for scriptPath (L89, L246, etc.)
2. **Unverified Breakpoints**: Expects `verified: false` initially but breakpoints still work (L120-122)
3. **Clean Stack Traces**: Expects fewer than 10 frames, no internal frames (L154)
4. **Stable Variable References**: No refresh needed after step operations (L221-227)
5. **Expression-Only Evaluation**: Statements should fail, only expressions work (L334-344)
6. **Scopes**: Expects "Locals" and "Globals" scopes (L179)

## Test Configuration

- **Timeout**: 60 seconds for main test, 30 seconds for setup (L243, L52)
- **Script**: Uses `examples/python/test_python_debug.py` (L89)
- **MCP Server**: Launched via `dist/index.js` with info logging (L35)
- **Wait Periods**: Strategic delays for async operations (L144, L219, L234, etc.)

## Error Handling

Robust error handling with try-catch blocks for session cleanup (L57-61, L78-82). Uses `callToolSafely` utility for graceful tool call failures. Tests validate both success scenarios and expected failure modes (Python statement evaluation).