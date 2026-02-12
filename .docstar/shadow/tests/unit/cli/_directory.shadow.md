# tests\unit\cli/
@generated: 2026-02-12T21:00:59Z

## Purpose
Comprehensive unit test suite for the Debug MCP Server CLI interface, validating all command functionality, error handling, and transport modes with extensive mocking and edge case coverage.

## Module Organization

### Transport Command Testing
- **`stdio-command.test.ts`** - Tests STDIO transport mode with server lifecycle, configuration handling, and graceful error recovery
- **`sse-command.test.ts`** - Tests Server-Sent Events transport mode including Express app creation, WebSocket-like communication, connection management, and health checks
- **`setup.test.ts`** - Tests CLI command structure creation, option parsing, and integration between stdio/SSE transport modes

### Utility Command Testing
- **`check-rust-binary.test.ts`** - Tests binary analysis capabilities for Rust executables with JSON/human-readable output modes and platform-specific format detection (GNU/DWARF vs MSVC/PDB)
- **`version.test.ts`** - Tests version extraction utility with package.json parsing, error handling, and environment-based console output control

### Infrastructure Testing
- **`error-handlers.test.ts`** - Tests global error handling setup for uncaught exceptions and unhandled promise rejections with structured logging and graceful shutdown

## Key Testing Patterns

### Mock Architecture
- **Dependency Injection**: All external dependencies (loggers, servers, file system, process) are injectable for complete isolation
- **Transport Layer Mocking**: Custom mocks for MCP SDK components with event simulation capabilities
- **Process Environment Control**: Comprehensive process.on, process.exit, and environment variable mocking

### Error Handling Coverage
- File system failures and invalid inputs
- Network transport errors and connection failures
- JSON parsing and configuration validation errors
- Process lifecycle and signal handling
- Graceful shutdown scenarios with resource cleanup

### Output Validation
- **Structured Logging**: Winston logger verification across all modules
- **CLI Output Modes**: JSON vs human-readable formatting validation
- **Stream Interception**: stdout/stderr capture for assertion verification
- **Console Control**: Environment-based output suppression testing

## Integration Points

### CLI Command Flow
1. **Setup Module** (`setup.test.ts`) creates command structure and parses options
2. **Transport Commands** (`stdio-command.test.ts`, `sse-command.test.ts`) handle server startup based on selected mode
3. **Error Handlers** (`error-handlers.test.ts`) provide global exception management
4. **Utility Commands** (`check-rust-binary.test.ts`, `version.test.ts`) support debugging and version information

### Shared Dependencies
- **Vitest Testing Framework**: Consistent mocking, async testing, and assertion patterns
- **Winston Logging**: Structured error/info logging across all commands
- **DebugMcpServer**: Core server instance with transport-agnostic interface
- **Commander.js**: CLI option parsing and command structure

## Architecture Validation
- **Transport Abstraction**: Tests verify both stdio and SSE modes work with same underlying server
- **Configuration Management**: Log levels, file paths, and transport-specific options properly handled
- **Resource Management**: Proper cleanup of connections, timers, and event listeners
- **Protocol Compliance**: JSON-RPC error formatting and MCP transport protocol adherence

## Testing Infrastructure
- **Mock Factories**: Reusable mock creation patterns for servers, transports, and loggers
- **Event Simulation**: Custom helpers for triggering transport events and process signals  
- **Async Testing**: Comprehensive Promise-based testing with proper error propagation
- **Behavioral Verification**: Extensive use of mock call inspection and state validation