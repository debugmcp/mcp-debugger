# tests\unit\session-manager-operations-coverage.test.ts
@source-hash: 0985f00c617b770a
@generated: 2026-02-19T23:47:50Z

## Purpose & Scope

This is a comprehensive unit test file focused on increasing code coverage for `session-manager-operations.ts` by testing error paths, edge cases, and failure scenarios (L1-4). The tests target the abstract `SessionManagerOperations` class through a concrete test subclass.

## Key Test Structure

**TestableSessionManagerOperations** (L12-16): Concrete subclass extending `SessionManagerOperations` with a no-op `handleAutoContinue()` implementation for testing purposes.

**Test Setup** (L35-134): Extensive beforeEach setup creating comprehensive mocks for:
- Logger with standard methods (info, error, warn, debug)
- ProxyManager aligned with new IProxyManager interface (L44-59)
- Session object with new session model properties (L61-73)
- SessionStore with factory usage pattern (L75-92)
- Complete dependencies object matching constructor requirements (L94-123)

## Major Test Categories

### ProxyManager Startup Edge Cases (L136-289)
Tests critical failure paths in proxy manager initialization:
- Log directory creation failures (L137-143)
- Python interpreter resolution errors → `PythonNotFoundError` (L145-155)
- Log directory verification failures (L157-163)
- Non-Python language executable resolution → `DebugSessionCreationError` (L165-176)
- Complete startup flow with CI environment handling (L178-253)
- MSVC toolchain validation with structured error handling (L255-288)

### Debugging Start Operations (L291-1185)
Extensive coverage of `startDebugging` scenarios:
- MSVC toolchain detection and structured response handling (L292-338)
- Dry run timeout scenarios (L743-783)
- Proxy creation and launch failures (L828-884)
- Error logging with proxy log tail capture (L886-925)
- Success scenarios with handshake completion (L948-1184)

### Operation Error Scenarios (L340-601)
Tests failure paths for core debugging operations:
- Continue operation failures (no proxy, not running, request failures) (L341-361)
- Step operations with DAP errors, timeouts, and internal failures (L363-416)
- Breakpoint setting with various failure modes (L419-471)
- Variable/stack trace/scope retrieval error handling (L473-600)

### Expression Evaluation (L602-740)
Comprehensive testing of expression evaluation:
- No proxy scenarios (L603-610)
- Evaluation errors and network failures (L612-648)
- Syntax error mapping to friendly messages (L650-664)
- Success scenarios with stack frame resolution (L696-740)

### Session State Management (L1365-1395)
Tests session lifecycle validation:
- Operations on non-existent sessions → `SessionNotFoundError` (L1365-1383)
- Operations on terminated sessions → `SessionTerminatedError` (L1385-1395)

## Critical Testing Patterns

**Environment Variable Management**: Multiple tests carefully save/restore CI and GITHUB_ACTIONS environment variables to avoid test pollution (L179-227, etc.)

**Timer Management**: Uses Vitest fake timers extensively for timeout testing with proper cleanup (L384-403, L667-693, etc.)

**Mock Verification**: Comprehensive verification of mock calls with specific argument matching using `expect.objectContaining()` patterns

**Error Response Structures**: Tests both thrown exceptions and structured error response objects depending on operation type

**Concurrent Operation Handling**: Tests graceful handling of multiple simultaneous step operations (L1408-1438)

## Key Utilities & Dependencies

- Imports from `@debugmcp/shared` for session state types (L9)
- Uses custom error classes from `debug-errors.ts` (L18-24)
- Leverages `createEnvironmentMock()` test utility (L25, L113)
- Extensive use of Vitest mocking capabilities throughout

This test suite provides comprehensive coverage of error conditions, edge cases, and failure scenarios that are critical for robust session management but difficult to trigger in normal operation.