# tests/unit/cli/error-handlers.test.ts
@source-hash: 129bd4d179f22fc0
@generated: 2026-02-10T00:41:30Z

**Purpose**: Unit tests for CLI error handlers module, validating global error handling setup for uncaught exceptions and unhandled promise rejections.

**Test Structure**:
- **Test Suite** (L5-125): "Error Handlers" - comprehensive testing of `setupErrorHandlers` function
- **Mock Setup** (L11-36): Creates Winston logger mock, process exit spy, and process.on interception system
- **Cleanup** (L38-42): Restores original process.on and clears listeners map

**Key Test Cases**:
- **Handler Registration** (L44-54): Verifies that error handlers are properly registered for `uncaughtException` and `unhandledRejection` events
- **Uncaught Exception Handling** (L56-81): Tests error logging format, stack trace capture, and process exit with code 1
- **Unhandled Rejection Handling** (L83-104): Tests promise rejection logging and graceful shutdown behavior
- **Default Exit Behavior** (L106-124): Validates fallback to `process.exit()` when no custom exit function provided

**Testing Infrastructure**:
- **Mock Logger** (L13-19): Stubbed Winston logger with error/warn/info/debug methods
- **Process Listener Capture** (L28-35): Custom process.on mock that stores event listeners in Map for later invocation
- **Exit Function Mock** (L22): Testable alternative to process.exit for verification

**Key Dependencies**:
- `../../../src/cli/error-handlers.js` - Main implementation under test
- `winston` types for logger interface
- `vitest` testing framework with mocking capabilities

**Testing Patterns**:
- Process event listener interception and manual triggering
- Structured error logging verification with specific message formats
- Graceful shutdown testing with configurable exit mechanisms