# packages/adapter-javascript/tests/unit/javascript-debug-adapter.connection.test.ts
@source-hash: ec04b64efbba3119
@generated: 2026-02-10T00:41:03Z

## Purpose
Test file for JavascriptDebugAdapter connection functionality, validating connection state management and event emission.

## Test Structure
- **Test Suite**: `JavascriptDebugAdapter.connection` (L15-47)
- **Dependencies**: Mocked AdapterDependencies with logger stub (L6-13)
- **Setup**: Fresh adapter instance per test with cleared mocks (L18-22)

## Key Test Cases

### Connection Test (L24-33)
- Validates `connect()` method behavior
- Asserts state transition to `CONNECTED`
- Verifies `isConnected()` returns true
- Confirms 'connected' event emission

### Disconnection Test (L35-46)
- Tests `disconnect()` method after establishing connection
- Validates state transition to `DISCONNECTED`
- Verifies `isConnected()` returns false
- Confirms thread clearing (`getCurrentThreadId()` returns null)
- Validates 'disconnected' event emission

## Dependencies
- **JavascriptDebugAdapter** from `../../src/index.js` (L2)
- **AdapterState** enum from `@debugmcp/shared` (L3)
- **Vitest** testing framework with mocking utilities (L1)

## Test Patterns
- Event-driven testing using event listeners and arrays
- Mock dependency injection with typed casting
- State assertion testing covering connection lifecycle
- Mock cleanup in beforeEach hooks