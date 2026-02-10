# tests/unit/utils/logger.test.ts
@source-hash: 7e305dcb98fe4ec6
@generated: 2026-02-10T00:41:38Z

## Purpose
Unit test suite for the logger utility module, testing winston-based logger creation, transport configuration, error handling, and environment-specific behaviors.

## Key Test Components

### Mock Setup (L4-35)
- **consoleTransportSpy** (L4-7): Mocks winston Console transport with type tracking
- **fileTransportSpy** (L8-11): Mocks winston File transport with type tracking  
- **createLoggerSpy** (L12-15): Mocks winston createLogger function
- **Winston Mock** (L17-34): Complete winston module mock including transports and formatters

### Test Environment Management (L38-53)
- **Environment preservation** (L38, L43, L51): Saves/restores process.env
- **Mock cleanup** (L44-47): Clears spies and sets up console.error spy before each test
- **Mock restoration** (L52): Restores all mocks after each test

### Core Test Cases

#### Default Logger Behavior (L55-71)
Tests that `createLogger()` adds both console and file transports by default, verifies filesystem operations for log directory creation.

#### Container Environment (L73-84) 
Tests MCP_CONTAINER environment variable behavior, ensuring logs write to `/app/logs/debug-mcp-server.log`.

#### Error Handling (L86-111)
- **Directory creation failures** (L86-98): Tests error reporting when log directory creation fails
- **Silenced console output** (L100-111): Tests CONSOLE_OUTPUT_SILENCED environment variable suppresses error output

#### Fallback Logger (L113-129)
Tests `getLogger()` behavior when called before logger initialization, verifies fallback logger creation with warning.

#### Transport Error Handling (L130-164)
- **Error logging** (L130-147): Tests winston transport error handling and console output
- **Silenced errors** (L149-164): Tests error suppression when console output is silenced

## Dependencies
- **vitest**: Test framework and mocking utilities
- **fs**: File system operations (mocked)
- **winston**: Logger library (fully mocked)
- **../../../src/utils/logger.js**: The actual logger utility being tested

## Test Patterns
- Comprehensive mocking of external dependencies
- Environment variable manipulation for different scenarios
- Error condition simulation and verification
- Spy-based verification of function calls and arguments