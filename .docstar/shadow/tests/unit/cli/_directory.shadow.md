# tests/unit/cli/
@generated: 2026-02-09T18:16:12Z

## Overall Purpose
This directory contains comprehensive unit tests for the CLI module of the DebugMCP system. It validates all CLI command handlers, error management, setup functionality, and utility functions using mock-driven testing patterns with the Vitest framework.

## Key Components and Architecture

### Command Handler Tests
- **`stdio-command.test.ts`**: Tests STDIO mode server startup, dependency injection, and error handling for the primary CLI communication mode
- **`sse-command.test.ts`**: Comprehensive testing of Server-Sent Events mode including Express app creation, connection management, session handling, and graceful shutdown
- **`check-rust-binary.test.ts`**: Validates Rust binary analysis functionality with format detection and output formatting capabilities

### Core Infrastructure Tests  
- **`setup.test.ts`**: Tests CLI framework initialization using Commander.js, including subcommand configuration, option parsing, and default behaviors
- **`error-handlers.test.ts`**: Validates global error handling setup for uncaught exceptions and unhandled promise rejections
- **`version.test.ts`**: Tests version utility with package.json reading, error handling, and console output management

## Testing Patterns and Standards

### Mock Architecture
All tests employ extensive mocking strategies:
- **Winston Logger mocking**: Consistent logger interface across all test suites
- **Process mocking**: Custom process.on implementations and exit function spying
- **File system mocking**: Controlled fs.promises.stat and file reading operations
- **Express/HTTP mocking**: Request/response simulation for SSE testing
- **Server mocking**: DebugMcpServer and transport lifecycle management

### Test Structure Conventions
- **Setup/Teardown**: Consistent beforeEach/afterEach patterns for mock initialization and cleanup
- **Error Boundary Testing**: Comprehensive validation of failure scenarios and error propagation
- **Dependency Injection**: Tests validate proper parameter passing and option handling
- **Output Verification**: Systematic validation of stdout/stderr content and logging behavior

## Key Entry Points Tested

### Primary CLI Commands
- **STDIO Command Handler**: Tests `handleStdioCommand` for standard input/output server mode
- **SSE Command Handler**: Tests `handleSSECommand` for Server-Sent Events web server mode  
- **Binary Check Command**: Tests `handleCheckRustBinaryCommand` for Rust binary analysis

### Configuration and Utilities
- **CLI Setup Functions**: Tests `createCLI`, `setupStdioCommand`, `setupSSECommand` for Commander.js integration
- **Error Handler Setup**: Tests `setupErrorHandlers` for global process error management
- **Version Utility**: Tests `getVersion` for package version extraction

## Internal Organization

### Command Flow Testing
Tests validate the complete command execution pipeline:
1. **CLI parsing** → Command recognition and option extraction
2. **Handler invocation** → Function calls with proper parameters
3. **Server lifecycle** → Startup, connection management, and shutdown
4. **Error handling** → Exception catching and graceful failure modes

### Session and Transport Management
SSE command tests specifically validate:
- Concurrent connection handling with unique session IDs
- Transport lifecycle management and cleanup
- Event-driven architecture with proper listener management
- Health check endpoints and status reporting

### Integration Points
Tests cover integration between:
- CLI framework (Commander.js) and custom command handlers
- Server instances and transport mechanisms (STDIO/SSE)
- Logging infrastructure and error reporting systems
- Process management and graceful shutdown sequences

## Test Coverage Focus
- **Error scenarios**: Comprehensive testing of failure modes and edge cases
- **Mock isolation**: Complete dependency isolation for unit test purity  
- **Output validation**: Systematic verification of all logging and console output
- **Lifecycle management**: Proper resource cleanup and connection handling
- **Configuration handling**: Option parsing, defaults, and environment variables