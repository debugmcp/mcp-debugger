# tests/core/unit/server/server-control-tools.test.ts
@source-hash: 97bb8987bfb49ae1
@generated: 2026-02-09T18:14:22Z

## Purpose
Comprehensive unit test suite for DebugMcpServer's control tools functionality, validating debugging operations like breakpoint management, step operations, and execution control through MCP tool handlers.

## Test Structure and Setup
- **Test Framework**: Vitest with extensive mocking (L4-24)
- **Main Setup** (L33-48): Creates mocked DebugMcpServer instance with dependencies
  - Mock dependencies via `createMockDependencies()` 
  - Mock MCP Server, StdioServerTransport, and SessionManager
  - Extracts `callToolHandler` from server for tool invocation testing
- **Cleanup** (L50-52): Clears all mocks after each test

## Core Test Categories

### Breakpoint Management (`set_breakpoint`, L54-153)
- **Basic breakpoint setting** (L55-93): Tests successful breakpoint creation with session validation
- **Conditional breakpoints** (L95-130): Validates breakpoint creation with conditions (`x > 10`)
- **Error handling** (L132-152): Tests session not found scenarios

### Debug Session Control (`start_debugging`, L155-256)
- **Standard debugging start** (L156-196): Tests full debugging initiation with script path, args, and DAP launch args
- **Dry run mode** (L198-233): Validates dry run execution without actual debugging
- **Error scenarios** (L235-255): Tests session validation failures

### Step Operations (L258-334)
Uses parameterized tests (`it.each`) for three operations:
- **step_over** → `stepOver` method
- **step_into** → `stepInto` method  
- **step_out** → `stepOut` method

Each operation tests:
- **Success scenarios** (L259-284): Validates proper method calls and response formatting
- **Error handling** (L286-306): Tests session not found cases
- **Failure responses** (L308-333): Tests SessionManager failure responses

### Execution Control
- **continue_execution** (L336-378): Tests resume functionality with success and error cases
- **pause_execution** (L380-408): Tests unimplemented functionality - expects McpError with InternalError code

## Key Testing Patterns
- **Session Validation**: All operations validate session existence and lifecycle state (`ACTIVE`)
- **Response Format**: Expects JSON responses with `success`, `message`/`error`, and operation-specific fields
- **Path Resolution**: Uses `expect.stringContaining()` for file path matching
- **Error Handling**: Tests both session-level errors and operation-level failures

## Dependencies and Mocking
- **External Dependencies**: MCP SDK (Server, Transport, Error types), DebugMcpServer, SessionManager
- **Test Helpers** (L12-18): Uses helper functions for creating consistent mock objects
- **Mock Strategy**: Complete mocking of all external dependencies with focused behavior validation

## Critical Test Invariants
- All debugging operations require valid, active sessions
- Tool responses follow consistent JSON structure with success/error indicators
- SessionManager method calls receive expected parameters (sessionId, file paths, arguments)
- Error responses maintain consistent format without throwing exceptions