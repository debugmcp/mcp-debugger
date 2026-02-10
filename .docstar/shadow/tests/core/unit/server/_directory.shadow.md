# tests/core/unit/server/
@generated: 2026-02-09T18:16:15Z

## Overall Purpose
This directory contains comprehensive unit test suite for the **DebugMCP Server**, validating all core debugging functionality through the Model Context Protocol (MCP) interface. Tests ensure proper tool registration, session management, debugging operations, and server lifecycle management with extensive mocking of external dependencies.

## Key Components and Architecture

### Test Structure
- **server-test-helpers.ts**: Central test utilities providing mock factories for all server dependencies
- **6 main test suites** covering different functional areas of the DebugMCP Server
- **Vitest framework** with comprehensive mocking strategy isolating units under test

### Core Test Areas

#### Server Infrastructure Tests
- **server-initialization.test.ts**: Tests server construction, MCP integration, and tool handler registration (validates all 14 debug tools are registered)
- **server-lifecycle.test.ts**: Tests server start/stop operations with proper resource cleanup and error handling
- **dynamic-tool-documentation.test.ts**: Validates AI-friendly tool documentation with generic, environment-agnostic path guidance

#### Debugging Functionality Tests
- **server-session-tools.test.ts**: Tests session lifecycle (create/list/close) with language validation and error handling
- **server-control-tools.test.ts**: Tests debugging operations (breakpoints, stepping, execution control) with comprehensive error scenarios
- **server-inspection-tools.test.ts**: Tests code inspection tools (variables, stack traces, scopes) with session state validation

#### Language Support Tests
- **server-language-discovery.test.ts**: Tests dynamic language discovery, metadata generation, and adapter registry integration with fallback mechanisms

## Public API Surface (Tool Handlers)
The server exposes 14 MCP tools across 4 categories:

### Session Management
- `create_debug_session`: Creates new debugging sessions with language validation
- `list_debug_sessions`: Lists all active debugging sessions
- `close_debug_session`: Closes specific debugging sessions

### Execution Control
- `set_breakpoint`: Sets breakpoints with optional conditions
- `start_debugging`: Initiates debugging with script paths and arguments
- `step_over`, `step_into`, `step_out`: Step-through debugging operations
- `continue_execution`, `pause_execution`: Execution flow control

### Code Inspection
- `get_variables`: Retrieves variables from specific scopes
- `get_stack_trace`: Gets current execution stack trace
- `get_scopes`: Lists available variable scopes
- `evaluate_expression`: Evaluates expressions in debugging context
- `get_source_context`: Retrieves source code context

## Internal Organization and Data Flow

### Mock Strategy Pattern
All tests use comprehensive mocking via **server-test-helpers.ts**:
- **Production Dependencies**: File system, process managers, network managers, environment
- **MCP Components**: Server, transport, error handling
- **Debug Components**: SessionManager, adapter registry

### Test Execution Flow
1. **Setup Phase**: Mock creation, server instantiation, tool handler extraction
2. **Tool Invocation**: Tests call `callToolHandler` with specific tool names and parameters
3. **Validation Phase**: Response format, SessionManager interactions, error handling
4. **Cleanup Phase**: Mock clearing, session cleanup, timer management

### Error Handling Patterns
- **Parameter Validation**: Uses MCP error codes for invalid parameters
- **Session State Validation**: Ensures sessions are active before operations
- **Graceful Degradation**: Tests fallback mechanisms when components fail
- **Consistent Response Format**: All tools return JSON with success/error structure

## Important Testing Conventions

### Mock Dependencies
- **Complete Isolation**: All external dependencies mocked to prevent side effects
- **Realistic Behavior**: Mocks provide functional implementations (e.g., path utilities work correctly)
- **Error Simulation**: Mocks can be configured to simulate various failure scenarios

### Tool Response Standards
- **Consistent JSON Structure**: All tools return `{success, message/error, ...}` format
- **MCP Compliance**: Tool responses conform to MCP protocol standards
- **Generic Documentation**: Tool descriptions use environment-agnostic language for AI consumption

### Session Lifecycle Management
- **State Validation**: All operations validate session existence and state
- **Resource Cleanup**: Tests ensure proper session cleanup during server shutdown
- **Thread Safety**: Tests validate debugging proxy manager and thread ID requirements

This test suite provides comprehensive coverage of the DebugMCP Server's MCP tool interface, ensuring reliable debugging functionality across different languages and environments while maintaining AI-friendly tool documentation.