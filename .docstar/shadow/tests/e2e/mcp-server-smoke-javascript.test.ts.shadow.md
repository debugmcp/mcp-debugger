# tests/e2e/mcp-server-smoke-javascript.test.ts
@source-hash: 0692a51e836a4311
@generated: 2026-02-09T18:15:13Z

**Primary Purpose**: End-to-end smoke test suite for JavaScript debugging functionality in an MCP (Model Context Protocol) server. Tests verify core debugging operations work correctly without coupling to implementation details.

**Key Test Classes and Structure**:
- Main test suite: `describe('JavaScript Debugging - Simple Smoke Tests')` (L21-341)
- Global test state management via `mcpClient`, `transport`, and `sessionId` variables (L22-24)
- Test setup/teardown managed by `beforeAll` (L26-54), `afterAll` (L56-76), and `afterEach` (L78-90)

**Core Test Functions**:
- **Full debugging cycle test** (L94-256): Comprehensive test covering session creation, breakpoint setting, execution control, variable inspection, expression evaluation, and cleanup
- **Multiple breakpoints test** (L258-295): Validates ability to set and manage multiple breakpoints in a single session
- **Source context test** (L297-340): Verifies source code context retrieval functionality

**Key Dependencies**:
- MCP SDK: `@modelcontextprotocol/sdk/client/index.js` and stdio transport (L13-14)
- Test framework: Vitest for test execution and assertions (L9)
- Utility: `parseSdkToolResult` from local smoke test utilities (L15)

**MCP Tool Operations Tested**:
- `create_debug_session`: Session initialization (L98-104, L262-268, L301-307)
- `set_breakpoint`: Breakpoint management (L114-121, L273-281)
- `start_debugging`: Debug execution start with DAP launch args (L129-140)
- `get_stack_trace`: Stack frame retrieval (L153-159)
- `get_local_variables`: Variable inspection (L169-175)
- `step_over`: Single-step execution control (L185-188)
- `evaluate_expression`: Runtime expression evaluation (L214-220)
- `continue_execution`: Resume program execution (L231-234)
- `get_source_context`: Source code context retrieval (L312-320)
- `close_debug_session`: Session cleanup (L245-248, L290-293, L335-338)

**Architecture Patterns**:
- **Test isolation**: Each test creates its own session and cleans up via `afterEach` hook
- **Error resilience**: Cleanup operations wrapped in try-catch to handle already-closed sessions (L58-65, L79-89)
- **Timing management**: Strategic delays using `setTimeout` for session stabilization (L149, L210, L241)
- **Validation approach**: Tests verify tool success flags and basic response structure rather than detailed implementation specifics

**Critical Configuration**:
- MCP server CLI path: `packages/mcp-debugger/dist/cli.mjs` (L29)
- Test script target: `examples/javascript/simple_test.js` (L92)
- Breakpoint line numbers: 11, 14 (primary test points)
- Timeout settings: 30s setup, 60s main test (L54, L256)

**Environment Requirements**:
- Requires pre-built MCP debugger CLI bundle with existence check (L30-34)
- NODE_ENV set to 'test' for server execution (L41)
- Stdio transport communication with spawned Node.js process (L36-43)