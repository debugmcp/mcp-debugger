# tests/e2e/mcp-server-smoke-python.test.ts
@source-hash: 303eef5e96fc8799
@generated: 2026-02-09T18:15:11Z

## E2E Python Adapter MCP Smoke Tests

End-to-end test suite for validating Python debugging functionality through MCP (Model Context Protocol) interface. Tests core debugging operations with known Python adapter characteristics.

### Primary Purpose
Validates Python debugging adapter integration via MCP tools, ensuring proper functionality of debug sessions, breakpoints, stepping, and expression evaluation.

### Key Test Structure
- **Test suite setup** (L24-73): MCP client and transport initialization with proper cleanup
- **Session management** (L75-85): Per-test cleanup of debug sessions to prevent interference
- **Main debugging flow test** (L87-243): Comprehensive test covering full debugging lifecycle
- **Multiple breakpoints test** (L245-289): Validates setting multiple breakpoints in same session
- **Expression evaluation test** (L291-349): Tests Python-specific evaluation constraints
- **Source context test** (L351-385): Validates source code retrieval functionality
- **Step into test** (L387-453): Tests stepping into function calls

### Key Dependencies
- `@modelcontextprotocol/sdk/client` for MCP client functionality (L16-17)
- `./smoke-test-utils.js` for utility functions `parseSdkToolResult` and `callToolSafely` (L18)
- Test Python script at `examples/python/test_python_debug.py` (L89, L246, etc.)

### Python Adapter Characteristics (Documented L5-11)
- Breakpoints initially return `verified: false` but function correctly
- Clean stack traces without internal debugging frames (L153-154)
- Stable variable references - no refresh needed after stepping (L221-227)
- Requires absolute paths for script execution (L88-89)
- Expression-only evaluation - statements are rejected (L334-344)

### MCP Tool Operations Tested
- `create_debug_session`: Initialize Python debugging session
- `set_breakpoint`: Set breakpoints at specific lines
- `start_debugging`: Launch Python script with debugging
- `get_stack_trace`: Retrieve current execution stack
- `get_scopes`/`get_variables`: Inspect variable state
- `step_over`/`step_into`: Single-step execution
- `continue_execution`: Resume execution
- `evaluate_expression`: Evaluate Python expressions
- `get_source_context`: Retrieve source code context
- `close_debug_session`: Cleanup debug session

### Test Configuration
- Extended timeouts (30s setup, 60s main test) for debugging operations
- MCP server launched with `--log-level info` for test diagnostics
- Uses absolute paths for Python script execution due to adapter requirements