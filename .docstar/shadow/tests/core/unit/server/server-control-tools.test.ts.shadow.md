# tests/core/unit/server/server-control-tools.test.ts
@source-hash: cdf6aad6d5f3a99b
@generated: 2026-02-11T16:12:53Z

## Purpose
Test suite for server control tools functionality in the DebugMCP server, validating debugging operations like breakpoint management and execution control.

## Test Structure
Main test suite (L26-409) organized into functional groups:
- **set_breakpoint tests** (L54-153): Validates breakpoint setting with and without conditions
- **start_debugging tests** (L155-256): Tests debugging session initialization including dry run mode
- **step operations tests** (L258-334): Parameterized tests for step_over, step_into, step_out
- **continue_execution tests** (L336-378): Tests execution continuation
- **pause_execution tests** (L380-408): Tests unimplemented pause functionality

## Key Test Setup (L33-48)
Mock infrastructure initialization:
- Creates mock dependencies via `createMockDependencies()` (L34)
- Mocks MCP SDK components (Server, StdioServerTransport) (L37-41)
- Initializes mock SessionManager (L43-44)
- Extracts `callToolHandler` for testing tool invocations (L47)

## Mock Strategy
Comprehensive mocking of external dependencies (L21-24):
- `@modelcontextprotocol/sdk` components
- SessionManager for debugging operations
- Production dependencies container

## Test Patterns
- **Session validation**: Most tests mock session existence/state validation
- **Error handling**: Tests both SessionManager errors and tool-level failures
- **Response format**: Validates JSON response structure with success/error fields
- **Parameterized testing**: Uses `it.each` for testing similar operations (L259-263, L286-289, L308-312)

## Key Dependencies
- **Vitest framework**: Test runner and mocking utilities (L4)
- **MCP SDK**: Server infrastructure and error types (L5-7)
- **DebugMcpServer**: Main server class under test (L8)
- **SessionManager**: Core debugging session management (L9)
- **Test helpers**: Mock creation utilities (L12-18)

## Notable Implementation Details
- Tests expect server to return success responses with error messages rather than throwing exceptions for operational errors
- Pause execution is tested as unimplemented functionality (L381-407)
- Breakpoint tests validate both simple and conditional breakpoints
- Path normalization is expected in SessionManager calls (`expect.stringContaining()`)