# tests/unit/session-manager-operations-coverage.test.ts
@source-hash: 93bef29951beaa83
@generated: 2026-02-09T18:15:23Z

## Purpose
Comprehensive test suite focused on edge cases and error paths for the `SessionManagerOperations` class, designed to improve test coverage beyond happy path scenarios. Tests error handling, timeouts, state management, and various failure modes of debugging operations.

## Test Structure
The test suite is organized into several focused describe blocks:

- **Setup (L28-122)**: Extensive beforeEach creating mock dependencies aligned with current APIs, including session store, proxy manager, logger, and all required factories
- **Error Path Testing (L128-281)**: Tests `startProxyManager` failures including disk errors, Python resolution failures, and toolchain validation issues
- **Operation Failures (L332-431)**: Tests continue, step, and breakpoint operations when proxy is unavailable or DAP requests fail
- **Variable/Stack/Scope Errors (L465-592)**: Tests data retrieval operations under various failure conditions
- **Expression Evaluation (L594-732)**: Tests both error and success scenarios for expression evaluation with timeout handling
- **Start Debugging Scenarios (L734-1177)**: Complex tests covering initialization failures, dry run timeouts, handshake issues, and success paths
- **Edge Cases (L1389-1431)**: Tests concurrent operations and undefined thread ID handling

## Key Mock Objects
- **mockSessionStore (L69-84)**: Simulates session persistence with `get`, `getOrThrow`, `update`, `updateState` methods
- **mockProxyManager (L38-52)**: Mock DAP proxy with event handling (`on`, `once`, `off`) and request methods
- **mockSession (L55-66)**: Test session with Python language, CREATED state, and breakpoint map
- **mockDependencies (L87-115)**: Factory pattern mocks for session store, proxy manager, file system, network, and adapter registry

## Critical Test Patterns
- **Error Propagation (L129-168)**: Tests that specific error types (PythonNotFoundError, DebugSessionCreationError) are properly wrapped and thrown
- **Toolchain Validation (L247-280)**: Tests MSVC toolchain detection and structured error responses for Rust debugging
- **Timeout Handling (L375-396, L658-685)**: Uses fake timers to test operation timeouts and proper cleanup
- **Environment Manipulation (L171-219)**: Carefully saves/restores CI environment variables for testing different execution contexts
- **State Verification (L318-325, L406)**: Ensures session state transitions are properly tracked through error scenarios

## Coverage Focus Areas
Tests specifically target:
- Log directory creation failures (L129-135)
- Interpreter resolution errors (L137-147) 
- DAP protocol failures (L347-353, L484-492)
- Proxy unavailability scenarios (L333-337, L466-473)
- Concurrent operation handling (L1400-1430)
- Dry run completion edge cases (L1179-1248)

## Dependencies
- **vitest**: Testing framework with mocking, fake timers, and assertions
- **SessionManagerOperations**: Main class under test from `../../src/session/session-manager-operations`
- **@debugmcp/shared**: Session state enums and types
- **debug-errors**: Custom error classes for specific failure modes
- **test-utils/mocks**: Environment mock utilities

## Notable Implementation Details
- Uses `vi.useFakeTimers()` for timeout testing with proper cleanup (L376, L659)
- Implements comprehensive proxy manager mock with chainable methods (L49-52)
- Tests both successful DAP responses with evaluation errors and network failures (L604-640)
- Verifies proper event listener cleanup in step operations (L1292)
- Tests toolchain validation flow with structured error attachment (L264-274)