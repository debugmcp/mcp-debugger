# tests\core\unit\server/
@generated: 2026-02-12T21:05:47Z

## Purpose
Comprehensive unit test suite for the DebugMcpServer, providing complete test coverage for server initialization, lifecycle management, tool functionality, and debugging session operations. This directory validates the core MCP (Model Context Protocol) server implementation that enables debugging capabilities for various programming languages.

## Key Components and Organization

### Core Server Testing
- **server-initialization.test.ts**: Tests server constructor, dependency injection, tool registration (14 debugging tools), and error handling
- **server-lifecycle.test.ts**: Validates server start/stop operations, resource cleanup, and error propagation
- **dynamic-tool-documentation.test.ts**: Tests tool documentation generation and MCP response serialization with environment-agnostic path descriptions

### Debugging Tool Categories
- **server-control-tools.test.ts**: Tests execution control tools (breakpoints, stepping, continue/pause operations)
- **server-inspection-tools.test.ts**: Tests runtime inspection tools (variables, stack traces, scopes)
- **server-session-tools.test.ts**: Tests session management tools (create, list, close debug sessions)

### Discovery and Configuration
- **server-language-discovery.test.ts**: Tests dynamic language discovery, adapter registry integration, and metadata generation

### Test Infrastructure
- **server-test-helpers.ts**: Centralized mock factory providing comprehensive mocks for all server dependencies (logger, file system, session manager, adapter registry, etc.)

## Public API Surface
The test suite validates 14 core MCP debugging tools organized into functional groups:
- **Session Management**: create_debug_session, list_debug_sessions, close_debug_session
- **Execution Control**: start_debugging, set_breakpoint, step_over, step_into, step_out, continue_execution, pause_execution
- **Runtime Inspection**: get_variables, get_stack_trace, get_scopes, evaluate_expression, get_source_context

## Internal Organization and Data Flow

### Test Architecture Pattern
1. **Mock Setup**: Uses centralized `server-test-helpers.ts` for consistent dependency mocking
2. **Server Initialization**: Creates DebugMcpServer with mocked dependencies
3. **Tool Handler Extraction**: Extracts registered MCP tool handlers for testing
4. **Tool Invocation**: Tests tools via MCP protocol with JSON request/response format
5. **Validation**: Asserts proper SessionManager interaction and response structure

### Dependency Flow
- **DebugMcpServer** (system under test) depends on SessionManager, Logger, FileSystem, Environment, AdapterRegistry
- **SessionManager** handles core debugging operations and session lifecycle
- **AdapterRegistry** provides language-specific debugging adapter discovery
- **MCP SDK** provides server framework and transport abstraction

### Mock Strategy
- Comprehensive mocking of external dependencies using Vitest
- Mock objects return optimistic responses by default (operations succeed)
- Error scenarios tested through mock rejections and exception throwing
- Shared mock factory ensures consistency across all test files

## Important Patterns and Conventions

### Error Handling Evolution
Tests validate a key architectural decision: tools return success responses with error messages rather than throwing exceptions for operational errors, while maintaining proper MCP protocol errors for parameter validation.

### Test Organization
- Each test file focuses on a specific functional area
- Consistent setup/teardown patterns with mock lifecycle management
- Parameterized testing for similar operations (stepping commands)
- Integration-style testing validating component interactions

### MCP Protocol Compliance
- Validates proper tool registration and handler setup
- Tests JSON request/response serialization
- Ensures consistent response structure across all tools
- Validates parameter validation and error codes

### Cross-Platform Considerations
- Path handling tests ensure environment-agnostic documentation
- File system mocking supports both Windows and Unix path formats
- Tests avoid hardcoded directory paths in tool descriptions