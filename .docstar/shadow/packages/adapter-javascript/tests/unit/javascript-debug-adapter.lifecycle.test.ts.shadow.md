# packages/adapter-javascript/tests/unit/javascript-debug-adapter.lifecycle.test.ts
@source-hash: 3c1812ef94f04ab3
@generated: 2026-02-09T18:14:01Z

## Purpose
Unit test suite for `JavascriptDebugAdapter` lifecycle state management, testing initialization, error handling, and disposal workflows using Vitest framework.

## Key Test Components

### Test Setup (L7-14, L19-23)
- **Mock dependencies**: Minimal `AdapterDependencies` stub with mocked logger methods
- **Test fixture**: Fresh `JavascriptDebugAdapter` instance created in `beforeEach` with mock cleanup

### Core Test Cases

#### Initialize Success Test (L25-45)
- Verifies successful initialization flow: `UNINITIALIZED` → `INITIALIZING` → `READY`
- Mocks `validateEnvironment` to return valid result (L33-37)
- Captures state transitions via `stateChanged` events (L26-29)
- Asserts single `initialized` event emission (L30-31, L44)

#### Initialize Failure Test (L47-65)
- Tests initialization failure with invalid environment
- Mocks `validateEnvironment` to return validation errors (L48-52)
- Verifies `AdapterError` with `ENVIRONMENT_INVALID` code is thrown (L61-63)
- Confirms state transitions to `ERROR` state (L64)

#### Dispose Test (L67-90)
- Tests cleanup workflow from connected state
- Sets up fully initialized and connected adapter (L69-75)
- Verifies event emission order: `disconnected` then `disposed` (L77-85)
- Confirms complete state reset: `UNINITIALIZED`, disconnected, no current thread (L87-89)

## Dependencies
- `JavascriptDebugAdapter` from `../../src/index.js` (L3)
- Shared types: `AdapterState`, `AdapterError`, `AdapterErrorCode` (L4)
- Vitest testing framework with mocking utilities (L1)

## Test Patterns
- State transition verification through event listeners
- Mock-based isolation of external dependencies
- Comprehensive lifecycle coverage from initialization to disposal
- Error path testing with specific error code validation