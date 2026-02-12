# tests\unit\cli/
@generated: 2026-02-12T21:05:41Z

## Overview
This directory contains comprehensive unit tests for the Debug MCP Server CLI components, providing complete test coverage for command-line interface functionality, server transports, error handling, and utility functions.

## Purpose & Scope
Tests all CLI functionality including:
- **Command handling** for both STDIO and SSE transport modes
- **Error management** with global exception/rejection handlers  
- **Binary analysis** capabilities for Rust debugging
- **Server lifecycle** management and configuration
- **Utility functions** for version reporting and setup

## Key Test Modules

### Core Command Testing
- **`stdio-command.test.ts`**: Tests STDIO transport mode with server startup, configuration handling, and error scenarios
- **`sse-command.test.ts`**: Comprehensive testing of SSE (Server-Sent Events) transport including Express app creation, WebSocket-like communication, connection management, and graceful shutdown
- **`setup.test.ts`**: Tests CLI command creation and configuration for both transport modes

### Infrastructure Testing  
- **`error-handlers.test.ts`**: Validates global error handling setup for uncaught exceptions and unhandled promise rejections
- **`version.test.ts`**: Tests version utility with package.json parsing and error fallbacks
- **`check-rust-binary.test.ts`**: Tests binary analysis functionality for Rust debugging with JSON/human-readable output modes

## Testing Architecture

### Mock Strategy
All tests use comprehensive mocking via Vitest:
- **Dependency injection patterns** for servers, loggers, and transport layers
- **Process interception** for exit handling and signal management
- **File system mocking** for configuration and binary analysis
- **Network transport mocking** for SSE connections and MCP protocol

### Common Patterns
- **Setup/teardown management** with proper mock cleanup
- **Error simulation** at multiple injection points for resilience testing
- **Output capture** for CLI verification (stdout/stderr)
- **Async operation testing** with Promise-based workflows
- **Event-driven testing** for server lifecycle and connection management

## Integration Points
The tests validate integration between:
- CLI commands and underlying server implementations
- Transport layers (STDIO/SSE) and MCP protocol handling
- Error handlers and logging infrastructure
- Configuration parsing and runtime behavior
- Binary analysis tools and debugging capabilities

## Test Coverage
Ensures reliability across:
- **Happy path scenarios** with successful operations
- **Error conditions** including network failures, invalid inputs, and system errors
- **Configuration variations** with default and custom settings
- **Process lifecycle** including startup, shutdown, and signal handling
- **Multiple transport modes** with appropriate protocol handling