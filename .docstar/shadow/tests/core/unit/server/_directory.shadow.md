# tests/core/unit/server/
@generated: 2026-02-10T21:26:24Z

## Purpose
This directory contains comprehensive unit tests for the DebugMcpServer core functionality, focusing on testing the Model Context Protocol (MCP) server implementation for debugging operations. The tests validate server initialization, lifecycle management, tool registration, session management, and debugging capabilities.

## Test Architecture

### Test Infrastructure (`server-test-helpers.ts`)
Central testing utilities providing comprehensive mock implementations for all server dependencies:
- **Mock Factory Pattern**: `createMockDependencies()` creates complete dependency injection containers
- **Component Mocks**: Server, SessionManager, StdioTransport, and AdapterRegistry mocks
- **Cross-Platform Support**: File system and path utilities with Windows/Unix compatibility
- **Handler Extraction**: `getToolHandlers()` utility for accessing registered MCP request handlers

### Core Server Testing

#### Server Lifecycle (`server-lifecycle.test.ts`)
Tests fundamental server operations:
- Start/stop lifecycle with stdio transport integration
- Error handling during server startup and shutdown
- Session cleanup during server termination
- Logging behavior validation

#### Server Initialization (`server-initialization.test.ts`)
Validates server constructor and setup:
- Dependency injection and configuration handling
- MCP tool handler registration (14 debugging tools total)
- Error boundary setup and propagation
- Tool availability verification

## MCP Tool Testing

### Session Management Tools (`server-session-tools.test.ts`)
Tests core session lifecycle operations:
- **`create_debug_session`**: Session creation with language validation and error handling
- **`list_debug_sessions`**: Session enumeration and state reporting
- **`close_debug_session`**: Session cleanup and resource management

### Debugging Control Tools (`server-control-tools.test.ts`)
Tests debugging execution control:
- **Breakpoint Management**: Setting breakpoints with conditional expressions
- **Execution Control**: Start debugging, step operations (over/into/out), continue/pause
- **Session Validation**: Ensures operations only work on active sessions
- **Error Scenarios**: Handles session not found, invalid states, and operation failures

### Inspection Tools (`server-inspection-tools.test.ts`)
Tests debugging introspection capabilities:
- **`get_variables`**: Variable retrieval with scope validation
- **`get_stack_trace`**: Stack frame inspection with thread ID handling
- **`get_scopes`**: Scope enumeration for frame analysis
- **Error Handling**: Graceful degradation from exceptions to error responses

## Advanced Features Testing

### Language Discovery (`server-language-discovery.test.ts`)
Tests dynamic language and adapter detection:
- **Dynamic Discovery**: `getSupportedLanguagesAsync` with adapter registry integration
- **Metadata Generation**: Language-specific configuration and executable detection
- **Container Environment**: Special handling for containerized environments
- **Validation Integration**: Language support validation before session creation
- **Fallback Mechanisms**: Graceful handling of discovery failures

### Tool Documentation (`dynamic-tool-documentation.test.ts`)
Tests MCP tool metadata generation:
- **Path Parameter Documentation**: Generic, environment-agnostic path guidance
- **Serialization**: Proper MCP response formatting for tool descriptions
- **AI Agent Optimization**: Path descriptions avoid specific directory references

## Key Testing Patterns

### Mock Strategy
- **Comprehensive Mocking**: All external dependencies mocked via `server-test-helpers.ts`
- **Dependency Injection**: Tests validate proper DI container usage
- **Component Isolation**: Each test focuses on specific functionality without side effects

### Error Handling Validation
- **Dual Error Patterns**: Tests both MCP protocol errors and graceful error responses
- **Session State Validation**: Ensures operations respect session lifecycle
- **Parameter Validation**: MCP parameter validation with proper error codes

### Integration Testing Approach
- **Tool Handler Testing**: Tests tools via extracted MCP request handlers
- **JSON Response Parsing**: Validates MCP response structure and content
- **Mock Verification**: Extensive interaction testing with dependency mocks

## Dependencies
- **Vitest**: Primary testing framework with comprehensive mocking capabilities
- **MCP SDK**: Model Context Protocol server and transport abstractions
- **Core Components**: DebugMcpServer, SessionManager, AdapterRegistry integration
- **Shared Types**: Cross-package type definitions for debugging operations

## Public API Coverage
The test suite validates all 14 MCP debugging tools:
- Session management (3 tools)
- Debugging control (7 tools) 
- Runtime inspection (4 tools)
- Plus server lifecycle, language discovery, and documentation generation

This comprehensive test suite ensures the DebugMcpServer provides a reliable MCP interface for AI-driven debugging operations across multiple programming languages.