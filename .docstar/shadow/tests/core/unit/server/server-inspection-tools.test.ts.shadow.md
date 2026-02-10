# tests/core/unit/server/server-inspection-tools.test.ts
@source-hash: 913ec9f1d88a7f1b
@generated: 2026-02-10T00:41:22Z

## Purpose
Test suite for server inspection tools (`get_variables`, `get_stack_trace`, `get_scopes`) that provide debugging session introspection capabilities in the MCP Debug Server.

## Test Structure
- Main test suite: "Server Inspection Tools Tests" (L25-366)
- Setup/teardown with mock dependencies and fake timers (L32-66)
- Three tool test groups: variables, stack traces, and scopes

## Key Test Components
- **Test setup** (L32-50): Creates mocked `DebugMcpServer`, `SessionManager`, and MCP SDK components using helper functions
- **Cleanup** (L52-66): Handles timer cleanup and session termination to prevent test pollution
- **Tool handler extraction** (L49): Extracts `callToolHandler` from mocked server for testing tool invocations

## Test Groups

### get_variables Tests (L68-180)
- **Success case** (L69-100): Validates variable retrieval with proper session validation and response format
- **Parameter validation** (L102-123): Tests MCP error handling for missing required `scope` parameter
- **Type validation** (L125-144): Tests handling of invalid scope parameter types
- **Error handling** (L146-179): Tests session-not-found scenarios with graceful error responses

### get_stack_trace Tests (L182-300)
- **Success case** (L183-208): Tests stack frame retrieval with mocked proxy manager and thread ID
- **Session validation** (L210-239): Tests missing session handling
- **Proxy manager validation** (L241-257): Tests missing proxy manager scenarios
- **Thread ID validation** (L259-280): Tests missing thread ID handling
- **SessionManager errors** (L282-299): Tests upstream error propagation

### get_scopes Tests (L302-365)
- **Success case** (L303-329): Tests scope retrieval for frame inspection
- **Error handling** (L331-364): Tests session-not-found error scenarios

## Dependencies
- **Vitest**: Test framework with mocking capabilities (L4)
- **MCP SDK**: Server, transport, and error types (L5-7)
- **Internal components**: DebugMcpServer, SessionManager, dependencies (L8-10)
- **Test helpers**: Mock creation utilities (L11-17)

## Mocking Strategy
- **Vi mocks** (L19-23): Mocks all external dependencies
- **Helper functions**: Uses dedicated mock creation functions for consistent test setup
- **Fake timers**: Prevents real timeouts during testing (L34, L55)

## Error Handling Patterns
Tests validate two error response patterns:
1. **MCP parameter validation**: Returns proper `McpError` with `InvalidParams` code
2. **Session/runtime errors**: Returns success response with error message in content

## Key Testing Insights
- Tests verify the evolution from runtime error throwing to graceful error responses
- Validates proper MCP protocol compliance for parameter validation
- Ensures session lifecycle management and proxy state validation
- Tests both happy path and comprehensive error scenarios for debugging tools