# tests\unit\cli/
@children-hash: b6f055463c3648e7
@generated: 2026-02-15T09:01:25Z

## Overall Purpose
This directory contains comprehensive unit tests for the Debug MCP Server's CLI module, providing thorough validation of command-line interface functionality, error handling, and transport layer implementations. The test suite ensures reliable CLI behavior across different execution modes and error scenarios.

## Key Components and Architecture

### CLI Core Testing
- **setup.test.ts** - Tests CLI command creation, configuration, and execution flow for both transport modes
- **version.test.ts** - Validates version utility with package.json parsing and error fallback mechanisms

### Transport Mode Testing
- **stdio-command.test.ts** - Tests standard input/output transport mode with server lifecycle management
- **sse-command.test.ts** - Comprehensive testing of Server-Sent Events transport with Express app creation, WebSocket-like communication, and HTTP streaming

### Specialized Command Testing
- **check-rust-binary.test.ts** - Tests Rust binary analysis CLI functionality with format detection and output modes

### Error Handling Infrastructure
- **error-handlers.test.ts** - Validates global error handling setup for uncaught exceptions and promise rejections

## Public API Coverage
The test suite validates the primary CLI entry points:
- **Command Setup**: `createCLI`, `setupStdioCommand`, `setupSSECommand` functions
- **Transport Handlers**: `handleStdioCommand`, `handleSSECommand` for different communication modes
- **Utility Commands**: `handleCheckRustBinaryCommand` for binary analysis
- **Infrastructure**: `setupErrorHandlers`, `getVersion` for CLI foundation

## Testing Patterns and Organization

### Mock Strategy
- **Dependency Injection**: All external dependencies (loggers, servers, file systems) are mocked for isolation
- **Transport Mocking**: Custom mock implementations with event simulation capabilities
- **Process Interception**: Console output capture and process event handling for integration testing

### Test Coverage Areas
- **Happy Path Validation**: Normal operation scenarios with expected configurations
- **Error Handling**: Comprehensive error injection and recovery testing
- **Configuration Management**: Option parsing, default values, and parameter validation
- **Server Lifecycle**: Startup, shutdown, and connection management across transport modes
- **Output Verification**: JSON and human-readable output format validation

### Key Dependencies Tested
- **Express.js** - Web server framework for SSE transport
- **MCP SDK** - Model Context Protocol transport layers
- **Winston** - Logging infrastructure
- **Commander.js** - CLI framework
- **Vitest** - Testing framework with comprehensive mocking

## Internal Organization
Tests follow a consistent structure with mock setup, test scenarios grouped by functionality, and comprehensive cleanup. Each test file focuses on a specific CLI component while maintaining integration test coverage through shared mocking patterns. The suite ensures the CLI can handle both programmatic usage and command-line execution across different transport protocols and error conditions.