# tests/unit/session-manager-operations-coverage.test.ts
@source-hash: 93bef29951beaa83
@generated: 2026-02-10T00:42:01Z

## Purpose
Comprehensive unit test suite for `SessionManagerOperations` focused on edge cases, error paths, and coverage gaps. Tests error scenarios, timeout handling, proxy manager failures, and various debugging operation edge cases.

## Test Structure
- **Setup (L28-122)**: Extensive mock infrastructure including session store, proxy manager, logger, and all dependencies
- **Main Test Groups**:
  - `startProxyManager` edge cases (L128-281) - Error handling during proxy initialization
  - Toolchain handling (L283-330) - MSVC toolchain detection and warnings
  - Operation failures (L332-409) - DAP request failures and timeouts
  - Breakpoint operations (L411-463) - Breakpoint setting edge cases
  - Variable/stack operations (L465-592) - Debug data retrieval errors
  - Expression evaluation (L594-732) - Expression evaluation scenarios
  - Start debugging flows (L734-1177) - Complex initialization patterns
  - Internal utilities (L1179-1355) - Helper method behaviors

## Key Mock Objects
- **mockProxyManager (L38-52)**: IProxyManager interface with event handling
- **mockSession (L55-66)**: Session model with state management
- **mockSessionStore (L69-84)**: Session persistence layer
- **mockDependencies (L87-115)**: All external dependencies including filesystem, network, adapters

## Critical Test Patterns
- **Environment Management**: Proper CI/GitHub Actions environment variable handling
- **Timer Mocking**: Extensive use of `vi.useFakeTimers()` for timeout testing
- **Error Propagation**: Tests that specific errors (PythonNotFoundError, SessionTerminatedError) bubble correctly
- **State Transitions**: Validates session state changes during operations
- **Event Handling**: Tests proxy manager event listener setup/teardown

## Edge Cases Covered
- Log directory creation failures (L129-135)
- Python interpreter resolution errors (L137-147)
- MSVC toolchain compatibility warnings (L247-280)
- Concurrent step operations (L1400-1430)
- Network timeouts and connection failures
- Malformed DAP responses
- Missing proxy managers during operations

## Notable Implementation Details
- Uses spy methods to mock internal operations like `startProxyManager` and `_executeStepOperation`
- Tests both success and failure paths for each operation
- Validates logging output for error conditions
- Ensures proper cleanup of event listeners and timers
- Tests dry-run completion detection and timeout handling