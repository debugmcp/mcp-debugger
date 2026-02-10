# tests/unit/cli/
@generated: 2026-02-10T01:19:42Z

## Purpose
Comprehensive unit test suite for the CLI module of a Debug MCP Server application, providing validation of command-line interface functionality, transport modes, error handling, and utility functions.

## Overall Architecture
This directory contains unit tests that mirror the structure and functionality of the main CLI module, testing the complete command-line interface lifecycle from setup through execution and error handling. The tests are organized to validate each major CLI component in isolation using extensive mocking strategies.

## Key Test Components

### Command Structure Testing
- **setup.test.ts**: Tests CLI creation, command registration, and option configuration for both stdio and SSE transport modes
- **stdio-command.test.ts**: Validates standard input/output transport mode with server startup, configuration, and error handling
- **sse-command.test.ts**: Comprehensive testing of Server-Sent Events transport mode including Express app creation, WebSocket-like communication, and session management

### Specialized Command Testing
- **check-rust-binary.test.ts**: Tests binary analysis capabilities for Rust executables with platform-specific format detection (GNU/DWARF vs MSVC/PDB)
- **version.test.ts**: Validates version utility functionality with package.json parsing and error scenarios

### Infrastructure Testing
- **error-handlers.test.ts**: Tests global error handling setup for uncaught exceptions and unhandled promise rejections

## Transport Mode Coverage
The test suite comprehensively covers both primary transport modes:
- **Stdio Transport**: Direct stdin/stdout communication for traditional CLI usage
- **SSE Transport**: HTTP-based streaming communication with Express server, CORS support, health checks, and session management

## Testing Patterns & Infrastructure

### Mocking Strategy
- **Dependency Injection**: All tests use injectable dependencies (loggers, server factories, exit functions) for isolation
- **Module Mocking**: Extensive use of Vitest's module mocking system for fs, express, MCP SDK components
- **Process Interception**: Custom process.on mocking and stdout/stderr capture for CLI behavior validation

### Error Scenarios
- File system failures and permission errors
- Invalid input validation and rejection
- Server startup and runtime exceptions
- JSON parsing and format validation errors
- Network and transport layer failures

### Async Testing
- Promise-based operation handling with proper await patterns
- Event-driven cleanup and listener management
- Graceful shutdown testing with SIGINT simulation
- Transport session lifecycle management

## Key Dependencies Tested
- **MCP SDK**: SSEServerTransport for protocol handling
- **Express.js**: Web framework for SSE endpoints
- **Winston**: Structured logging with configurable levels
- **Commander.js**: CLI argument parsing and command structure
- **Node.js fs**: File system operations for configuration and binary analysis

## Public API Surface Tested
- `createCLI()`: Main CLI application factory
- `setupStdioCommand()` / `setupSSECommand()`: Transport mode configuration
- `handleStdioCommand()` / `handleSSECommand()`: Command execution handlers
- `handleCheckRustBinaryCommand()`: Binary analysis functionality
- `setupErrorHandlers()`: Global error handling configuration
- `getVersion()`: Version utility function

## Integration Points
The tests validate the complete CLI workflow from command parsing through server startup, ensuring proper integration between:
- Command-line argument processing
- Logger configuration and structured output
- Transport layer initialization and communication
- Error handling and graceful shutdown
- Binary analysis and platform detection

This test suite ensures the CLI module provides a robust, well-tested interface for MCP server deployment in both development (stdio) and production (SSE) environments.