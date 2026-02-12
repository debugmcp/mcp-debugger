# tests/unit/cli/
@generated: 2026-02-11T23:47:40Z

## Purpose
Comprehensive unit test suite for the CLI module of the Debug MCP Server, providing complete coverage of command-line interface functionality including command handlers, error management, server setup, and transport mechanisms.

## Test Architecture

### Command Handler Testing
- **stdio-command.test.ts**: Tests STDIO transport mode with server startup, configuration handling, and error scenarios
- **sse-command.test.ts**: Tests Server-Sent Events transport mode including Express app creation, connection management, and WebSocket-like communication
- **check-rust-binary.test.ts**: Tests binary analysis command with file system validation and output formatting (JSON/human-readable)

### Infrastructure Testing
- **setup.test.ts**: Tests CLI command creation and configuration for both stdio and SSE transport modes using Commander.js
- **error-handlers.test.ts**: Tests global error handling setup for uncaught exceptions and unhandled promise rejections
- **version.test.ts**: Tests version utility with package.json parsing and error fallback scenarios

## Key Testing Patterns

### Mock Strategy
- **Dependency Injection**: All external dependencies (loggers, servers, file system) are injectable for isolation
- **Transport Mocking**: SSE and STDIO transports are comprehensively mocked with event simulation capabilities
- **Process Interception**: stdout/stderr capture and process event listener mocking for CLI behavior verification

### Error Handling Coverage
- Server startup failures and graceful degradation
- File system errors and invalid input validation
- JSON parsing errors and malformed configuration handling
- Transport connection errors and cleanup scenarios
- Global exception and rejection handling

### Integration Points
- **Commander.js Integration**: Command parsing, option validation, and handler execution
- **Winston Logger Integration**: Structured logging with configurable levels
- **Express.js Integration**: HTTP server setup with CORS, routing, and middleware
- **MCP SDK Integration**: Protocol transport layer testing

## Public API Coverage
Tests validate the primary CLI entry points:
- `createCLI()` - Main CLI application factory
- `setupStdioCommand()` - STDIO transport command setup
- `setupSSECommand()` - SSE transport command setup
- `handleStdioCommand()` - STDIO mode execution handler
- `handleSSECommand()` - SSE mode execution handler
- `handleCheckRustBinaryCommand()` - Binary analysis command handler
- `setupErrorHandlers()` - Global error management
- `getVersion()` - Version utility

## Test Infrastructure
- **Vitest Framework**: Modern testing with comprehensive mocking capabilities
- **Process Simulation**: Custom process.on mocking and exit function injection
- **Timer Mocking**: Fake timers for ping intervals and timeout testing
- **Stream Interception**: stdout/stderr capture for output verification

## Data Flow Testing
- Command line parsing → option validation → handler execution
- Server factory → server instantiation → transport setup → connection management
- Error occurrence → logging → graceful shutdown → process exit
- Binary analysis → format detection → output formatting → result display

The test suite ensures complete CLI functionality coverage with robust error handling, proper resource cleanup, and transport-agnostic operation modes.