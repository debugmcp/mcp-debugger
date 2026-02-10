# tests/unit/cli/
@generated: 2026-02-10T21:26:20Z

## Purpose
Comprehensive unit test suite for the Debug MCP Server CLI module, providing complete test coverage for command-line interface functionality, error handling, and transport modes (STDIO and SSE).

## Key Components and Structure

### Command Testing (`setup.test.ts`)
- **CLI Creation**: Tests for `createCLI()` function that initializes the command-line interface
- **Command Configuration**: Validates option setup for both STDIO and SSE transport modes
- **Default Behavior**: Ensures STDIO is the default command when no subcommand is specified

### Transport Mode Testing
- **STDIO Mode (`stdio-command.test.ts`)**: Tests standard input/output transport with server startup, configuration handling, and error scenarios
- **SSE Mode (`sse-command.test.ts`)**: Comprehensive testing of Server-Sent Events transport including Express app creation, WebSocket-like communication, connection management, and graceful shutdown

### Specialized Command Testing
- **Binary Analysis (`check-rust-binary.test.ts`)**: Tests Rust binary format detection and analysis capabilities with both JSON and human-readable output modes
- **Version Utility (`version.test.ts`)**: Tests version extraction from package.json with error handling and fallback mechanisms

### Infrastructure Testing
- **Error Handling (`error-handlers.test.ts`)**: Tests global error handler setup for uncaught exceptions and unhandled promise rejections
- **Process Management**: Validates graceful shutdown, signal handling (SIGINT), and process exit behaviors

## Testing Architecture

### Mock Strategy
- **Dependency Injection**: All external dependencies (loggers, servers, file system) are injectable for isolation
- **Transport Mocking**: Custom mock implementations for MCP SDK transport layers
- **Process Interception**: Mocks for process.exit, console output, and signal handlers

### Coverage Patterns
- **Happy Path Testing**: Validates successful command execution and server startup
- **Error Simulation**: Comprehensive error injection at multiple failure points
- **Configuration Validation**: Tests option parsing, default values, and validation
- **Resource Cleanup**: Verifies proper cleanup of connections, listeners, and resources

## Key Dependencies
- **Vitest**: Primary testing framework with mocking capabilities
- **Commander.js**: Command-line interface library being tested
- **Express**: Web framework for SSE transport testing
- **MCP SDK**: Model Context Protocol transport layers
- **Winston**: Logging framework integration testing

## Public API Surface Tested
- `createCLI()`: Main CLI instance creation
- `setupStdioCommand()`: STDIO transport command setup
- `setupSSECommand()`: SSE transport command setup
- `handleStdioCommand()`: STDIO mode execution handler
- `handleSSECommand()`: SSE mode execution handler
- `handleCheckRustBinaryCommand()`: Binary analysis command handler
- `setupErrorHandlers()`: Global error handling setup
- `getVersion()`: Version utility function

## Internal Organization
The test suite mirrors the CLI module structure, with each test file corresponding to a specific CLI component or command. Tests are organized by functional area (transport modes, utilities, error handling) and follow consistent patterns for mocking, setup, and verification.

## Testing Conventions
- Mock isolation with proper setup/teardown in beforeEach/afterEach hooks
- Async testing patterns with Promise-based operations
- Environment variable testing for conditional behavior
- Signal handling and process lifecycle testing
- Output capture and verification for CLI feedback
- Dependency injection for testable architecture