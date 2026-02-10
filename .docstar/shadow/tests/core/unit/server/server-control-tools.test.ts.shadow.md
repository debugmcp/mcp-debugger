# tests/core/unit/server/server-control-tools.test.ts
@source-hash: 97bb8987bfb49ae1
@generated: 2026-02-10T00:41:26Z

## Purpose
Test suite for debugging server control tools functionality, specifically testing breakpoint management and execution control operations through the MCP (Model Context Protocol) server interface.

## Test Structure
- **Main Test Suite (L26-409)**: `Server Control Tools Tests` - comprehensive testing of debugging tool operations
- **Setup/Teardown (L33-52)**: Mock initialization for dependencies including server, session manager, and transport layers
- **Tool Handler Access (L47)**: Extracts `callToolHandler` from mock server for tool invocation testing

## Key Test Groups

### Breakpoint Management Tests (L54-153)
- **Basic Breakpoint Setting (L55-93)**: Tests successful breakpoint creation with file/line parameters
- **Conditional Breakpoints (L95-130)**: Tests breakpoints with conditional expressions
- **Error Handling (L132-152)**: Tests session validation and not-found scenarios

### Debugging Session Control (L155-256)
- **Start Debugging (L156-196)**: Tests successful debugging session initiation with script path and DAP launch arguments
- **Dry Run Mode (L198-233)**: Tests command preview without actual execution
- **Session Validation (L235-255)**: Tests error responses for invalid sessions

### Step Operation Tests (L258-334)
- **Parameterized Step Tests (L259-284)**: Uses `it.each` to test step_over, step_into, step_out operations
- **Error Scenarios (L286-306)**: Tests session validation failures for step operations
- **Failure Response Handling (L308-333)**: Tests handling of operation failures (e.g., not paused state)

### Execution Control Tests (L336-408)
- **Continue Execution (L337-378)**: Tests resuming paused debugging sessions
- **Pause Execution (L381-407)**: Tests unimplemented pause functionality (throws McpError)

## Mock Infrastructure
- **Dependencies**: Uses `createMockDependencies()` for logger and adapter registry mocking
- **Server Components**: Mocks `Server`, `StdioServerTransport`, and `SessionManager`
- **Test Helpers**: Leverages helper functions from `server-test-helpers.js` for consistent mock setup

## Error Handling Patterns
- Tests both exception-based errors (McpError for unimplemented features) and structured error responses
- Validates session lifecycle checks (ACTIVE vs terminated sessions)
- Confirms error messages include session IDs and context information

## Key Dependencies
- `@modelcontextprotocol/sdk` for MCP server infrastructure
- `@debugmcp/shared` for Breakpoint type definitions
- Vitest testing framework with mocking capabilities
- Custom session management and dependency injection systems