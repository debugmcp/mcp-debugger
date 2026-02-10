# tests/core/unit/server/server-initialization.test.ts
@source-hash: 505ec4fcb10637b9
@generated: 2026-02-10T00:41:13Z

## Purpose
Comprehensive unit tests for DebugMcpServer initialization, configuration, and tool handler registration. Validates server constructor behavior, dependency injection, error handling, and MCP tool availability.

## Test Structure

### Main Test Suite (L25-177)
- **Constructor Tests (L50-111)**: Server initialization with various configurations
- **Tool Handler Tests (L113-176)**: MCP tool registration and execution validation

## Key Test Cases

### Server Initialization (L51-110)
- **Basic Configuration (L51-64)**: Validates server creation with debug log level, checks Server SDK initialization with correct metadata
- **Log File Configuration (L66-81)**: Tests custom log file path handling and session log directory derivation using `path.resolve()`
- **Error Handling (L83-89)**: Verifies graceful handling of dependency creation failures
- **Tool Registration (L91-96)**: Confirms proper MCP request handler setup (ListTools, CallTool)
- **Error Handler Setup (L98-110)**: Tests server error callback configuration and logging integration

### Tool Handler Validation (L114-175)
- **Tools List Handler (L114-140)**: Validates all 14 debugging tools are properly registered:
  - Session management: create_debug_session, list_debug_sessions, close_debug_session
  - Debugging control: start_debugging, set_breakpoint, step_over/into/out, continue/pause_execution
  - Inspection tools: get_variables, get_stack_trace, get_scopes, evaluate_expression, get_source_context
- **Unknown Tool Error (L142-153)**: Tests proper error handling for invalid tool names
- **Tool Execution Errors (L155-175)**: Validates error propagation and logging for failed tool operations

## Mock Infrastructure
- Uses comprehensive mocking via `server-test-helpers.js` (L12-17)
- Mocks SDK components: Server, StdioServerTransport (L20-21)
- Mocks application components: SessionManager, dependencies (L22-23)
- **Mock Setup (L32-44)**: Creates interconnected mock objects with proper dependency injection

## Dependencies
- **Vitest**: Testing framework with mocking capabilities (L4)
- **MCP SDK**: Server and transport abstractions (L5-6)
- **Application Components**: DebugMcpServer, SessionManager, dependency container (L7-9)
- **Test Utilities**: Comprehensive mock factory functions (L11-17)

## Testing Patterns
- Consistent mock setup/teardown lifecycle (L32-48)
- Error boundary testing with expected exceptions
- Async handler testing with proper error propagation
- Integration-style testing of component interactions
- Configuration validation through dependency injection verification