# tests\core\unit\server/
@children-hash: f21ca6d89be30013
@generated: 2026-02-21T08:28:45Z

## Purpose
Comprehensive unit test suite for the DebugMcpServer core functionality, providing end-to-end validation of MCP (Model Context Protocol) debugging server operations including session management, tool execution, and server lifecycle.

## Key Components

### Test Infrastructure
- **server-test-helpers.ts** - Central mock factory providing comprehensive mocks for all server dependencies (logger, filesystem, session manager, MCP SDK components)
- **Mock Strategy** - Consistent mocking approach across all tests using Vitest framework with dependency injection pattern

### Core Test Suites

#### Server Lifecycle & Initialization
- **server-initialization.test.ts** - Tests server constructor, dependency injection, tool registration, and error handling setup
- **server-lifecycle.test.ts** - Validates server startup/shutdown procedures with proper cleanup and error propagation

#### MCP Tool Categories
- **server-session-tools.test.ts** - Tests session management tools (`create_debug_session`, `list_debug_sessions`, `close_debug_session`)
- **server-control-tools.test.ts** - Tests debugging control tools (breakpoints, stepping, execution control)
- **server-inspection-tools.test.ts** - Tests runtime inspection tools (`get_variables`, `get_stack_trace`, `get_scopes`)

#### Dynamic Features
- **server-language-discovery.test.ts** - Tests dynamic language detection, adapter registry integration, and metadata generation
- **dynamic-tool-documentation.test.ts** - Tests MCP tool documentation generation with environment-agnostic path guidance

## Public API Testing Surface

### Tool Handler Testing Pattern
All test suites follow consistent pattern:
1. Extract `callToolHandler` from mock server via `getToolHandlers()`
2. Invoke tools using MCP protocol structure with proper parameters
3. Parse JSON responses from `result.content[0].text`
4. Validate both success and error scenarios

### Core Tools Tested (14 total)
- **Session Management**: create_debug_session, list_debug_sessions, close_debug_session
- **Debugging Control**: start_debugging, set_breakpoint, step_over/into/out, continue/pause_execution
- **Runtime Inspection**: get_variables, get_stack_trace, get_scopes, evaluate_expression, get_source_context

## Internal Organization

### Mock Architecture
- **Centralized Mocking** - `server-test-helpers.ts` provides factory functions for all dependencies
- **Comprehensive Coverage** - Mocks include logger, filesystem, process managers, environment, path utilities, adapter registry
- **Isolation Strategy** - Each test creates fresh mock instances in `beforeEach` for proper test isolation

### Error Handling Patterns
Tests validate two distinct error response patterns:
1. **MCP Parameter Validation** - Returns `McpError` with `InvalidParams` code for protocol violations
2. **Runtime/Session Errors** - Returns success response with error message in content for operational failures

### Integration Points
- **SessionManager Integration** - All debugging operations tested through mock session manager
- **Adapter Registry Integration** - Language discovery and session creation validate adapter system
- **MCP SDK Integration** - Server initialization and tool registration tested with mock SDK components

## Key Testing Insights
- Tests ensure graceful error handling evolution from exceptions to structured error responses
- Validates MCP protocol compliance for parameter validation and response formatting
- Comprehensive coverage of both happy path and edge case scenarios
- Environment-agnostic approach for cross-platform compatibility
- Proper session lifecycle management and cleanup validation