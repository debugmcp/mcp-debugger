# tests/unit/utils/logger.test.ts
@source-hash: 7e305dcb98fe4ec6
@generated: 2026-02-09T18:14:47Z

## Purpose
Unit test suite for the logger utility module, testing Winston logger configuration, transport setup, error handling, and environment-specific behavior.

## Test Structure
- **Main test suite** (L41-165): "logger utility" with comprehensive beforeEach/afterEach setup
- **Setup hooks** (L42-53): Environment restoration, spy cleanup, and mock resets

## Key Mock Infrastructure
- **Winston mocks** (L17-34): Complete Winston module mock with spies for transports, formatters, and logger creation
- **Transport spies** (L4-11): `consoleTransportSpy` and `fileTransportSpy` track transport instantiation with type identification
- **Logger creation spy** (L12-15): `createLoggerSpy` returns mock logger with `on` and `warn` methods

## Test Coverage Areas

### Transport Configuration (L55-71)
Tests default behavior of adding both console and file transports, verifies transport types in logger config, and filesystem interaction for log directory creation.

### Container Environment (L73-84) 
Validates MCP container-specific logging path (`/app/logs/debug-mcp-server.log`) when `MCP_CONTAINER=true`.

### Error Handling (L86-111)
- **Directory creation failures** (L86-98): Tests error reporting when log directory creation fails
- **Console silencing** (L100-111): Verifies error suppression when `CONSOLE_OUTPUT_SILENCED=1`

### Fallback Logger (L113-129)
Tests `getLogger()` behavior before initialization, verifying fallback logger creation with default namespace and warning message.

### Transport Error Handling (L130-164)
- **Error logging** (L130-147): Tests Winston transport error event handling with console output
- **Error suppression** (L149-164): Verifies transport error silencing with `CONSOLE_OUTPUT_SILENCED`

## Dependencies
- **Vitest**: Test framework with mocking capabilities
- **fs module**: File system operations (mocked)
- **Winston**: Logging library (fully mocked)
- **Target module**: `../../../src/utils/logger.js` (imported after mocks)

## Test Patterns
- Environment variable manipulation with restoration
- Comprehensive spy setup and cleanup
- Mock chaining for complex object behavior
- Error simulation through mock implementations