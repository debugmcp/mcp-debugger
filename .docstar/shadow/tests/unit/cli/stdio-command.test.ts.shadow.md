# tests/unit/cli/stdio-command.test.ts
@source-hash: ee0861db5a04e08b
@generated: 2026-02-09T18:14:41Z

## Purpose
Unit test suite for the `handleStdioCommand` function from the CLI module. Tests the STDIO mode server startup flow, including success scenarios, error handling, and dependency injection patterns.

## Test Structure
- **Main describe block** (L8): "STDIO Command Handler" - comprehensive test coverage for CLI stdio command
- **Mock setup** (L14-38): Creates mocks for logger, server factory, exit process, and DebugMcpServer instance
- **beforeEach** (L14-38): Reinitializes all mocks with proper structure before each test

## Key Test Cases

### Success Path Testing
- **Basic stdio startup** (L40-72): Verifies successful server initialization with log level setting, server factory invocation, and startup logging
- **Optional parameters handling** (L74-92): Tests behavior when log level is not provided, ensuring existing logger configuration is preserved

### Error Handling Testing  
- **Server start failure** (L94-112): Tests error logging and process exit (code 1) when server.start() rejects
- **Default process.exit usage** (L114-130): Verifies fallback to `process.exit()` when custom exitProcess function not provided
- **Factory error handling** (L132-149): Tests error handling when server factory itself throws an exception

## Dependencies
- **Vitest testing framework**: `describe`, `it`, `expect`, `vi`, `beforeEach` (L1)
- **Target function**: `handleStdioCommand` from `../../../src/cli/stdio-command.js` (L2)
- **Type imports**: Winston Logger type for proper mock typing (L3)
- **Server class**: `DebugMcpServer` from `../../../src/server.js` (L4, mocked at L6)

## Mock Architecture
- **Logger mock** (L16-22): Implements Winston logger interface with spy functions
- **Server mock** (L25-31): Mock DebugMcpServer with nested server.connect, start, and stop methods
- **Dependency injection pattern**: Tests use dependency injection to provide mocks via options parameter

## Testing Patterns
- Comprehensive mock verification using `toHaveBeenCalledWith` for exact parameter matching
- Error scenario testing with rejected promises and thrown exceptions  
- Process exit behavior testing with both custom and default exit functions
- Log level mutation testing to verify conditional behavior