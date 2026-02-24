# tests\unit\cli/
@children-hash: 486a6c5690d3e625
@generated: 2026-02-24T21:14:56Z

## Purpose

The `tests/unit/cli` directory contains comprehensive unit tests for the Debug MCP CLI application's command-line interface components. These tests validate all major CLI functionality including binary analysis, error handling, server startup, and transport layer operations across both STDIO and SSE modes.

## Test Architecture

### Core CLI Framework Testing
- **setup.test.ts**: Tests CLI command structure, option parsing, and command handler registration for both STDIO and SSE transport modes
- **version.test.ts**: Validates version utility function with error handling and fallback behavior

### Command Handler Testing
- **stdio-command.test.ts**: Tests STDIO transport mode server startup, configuration handling, and error scenarios with dependency injection patterns
- **sse-command.test.ts**: Comprehensive testing of SSE transport including Express app setup, connection management, route handling, and graceful shutdown procedures

### Specialized Functionality
- **check-rust-binary.test.ts**: Tests binary analysis CLI command with mock file system operations and binary format detection
- **error-handlers.test.ts**: Validates global error handling setup for uncaught exceptions and unhandled promise rejections

## Testing Patterns & Dependencies

### Mock Strategy
All tests use extensive mocking to isolate components:
- **Process mocking**: Prevents actual process termination and captures signal handlers
- **File system mocking**: Simulates file operations for binary analysis and version reading
- **Network mocking**: Mock Express servers and HTTP connections for SSE testing
- **Logger mocking**: Winston-compatible mock loggers for output verification

### Test Infrastructure
- **Vitest framework**: Primary testing framework with built-in mocking capabilities
- **Dependency injection**: All external dependencies are injectable for isolation
- **Output capture**: Intercepts stdout/stderr for assertion verification
- **Event simulation**: Mock event emitters for connection lifecycle testing

## Key Components Tested

### Transport Modes
- **STDIO Mode**: Standard input/output transport with logging configuration
- **SSE Mode**: Server-Sent Events with Express server, CORS handling, and connection management

### Error Handling
- **Global handlers**: Process-level exception and rejection handling
- **Transport errors**: Connection failures and cleanup procedures
- **Graceful shutdown**: SIGINT handling with proper resource cleanup

### Configuration Management
- Command-line option parsing and validation
- Log level configuration and file output
- Port configuration for SSE mode
- Environment variable handling

## Test Coverage Areas

### Happy Path Scenarios
- Successful server startup in both transport modes
- Proper command parsing and option handling
- Binary analysis with valid files
- Health endpoint responses and connection tracking

### Error Scenarios
- Server startup failures and recovery
- Invalid command-line arguments
- File system errors and JSON parsing failures
- Network connection errors and transport failures
- Process signal handling and cleanup

### Edge Cases
- Missing configuration values with sensible defaults
- Concurrent connection management
- Session validation and cleanup
- Console output suppression via environment variables

This test suite ensures robust CLI functionality across all supported transport modes and provides comprehensive error handling validation for production deployment.