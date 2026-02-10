# tests/unit/cli/error-handlers.test.ts
@source-hash: 129bd4d179f22fc0
@generated: 2026-02-09T18:14:41Z

## Purpose
Unit test suite for the CLI error handlers module, specifically testing the `setupErrorHandlers` function that registers global process error listeners for uncaught exceptions and unhandled promise rejections.

## Key Test Structure
- **Test Suite**: "Error Handlers" (L5-125)
- **Setup/Teardown**: Mock logger and process event system (L11-42)
- **Core Tests**: Handler registration and behavior verification (L44-124)

## Test Components

### Mock Setup (L11-36)
- `mockLogger` (L13-19): Winston logger mock with standard logging methods
- `mockExitProcess` (L22): Spy function to capture process exit calls
- `processListeners` (L26): Map to track registered event listeners
- Process.on mocking (L29-35): Captures event listener registrations

### Test Cases

**Handler Registration Tests (L44-54)**
- Verifies `uncaughtException` handler registration (L44-48)
- Verifies `unhandledRejection` handler registration (L50-54)

**Exception Handling Test (L56-81)**
- Creates test error with stack trace (L59-61)
- Extracts and triggers uncaughtException handler (L64-67)
- Validates logging format: `[Server UNCAUGHT_EXCEPTION]` with error details (L70-77)
- Confirms process exit with code 1 (L79-80)

**Rejection Handling Test (L83-104)**
- Creates test promise rejection (L86-90)
- Extracts and triggers unhandledRejection handler (L93-96)
- Validates dual logging: reason and promise objects (L99-100)
- Confirms process exit with code 1 (L102-103)

**Default Exit Behavior Test (L106-124)**
- Tests fallback to `process.exit` when no custom exit function provided (L107-109)
- Uses `vi.spyOn` to mock `process.exit` (L107)
- Validates default exit behavior (L121)

## Dependencies
- **Testing**: Vitest framework with mocking capabilities
- **Source**: `../../../src/cli/error-handlers.js` - the module under test
- **Types**: Winston Logger type definitions

## Test Patterns
- **Process Mocking**: Custom process.on implementation to capture listeners
- **Error Simulation**: Manual error creation and handler triggering
- **Spy Verification**: Detailed assertion of log calls and exit behavior
- **Cleanup**: Proper restoration of original process methods in afterEach