# packages/adapter-javascript/tests/unit/javascript-debug-adapter.connection.test.ts
@source-hash: ec04b64efbba3119
@generated: 2026-02-09T18:13:58Z

## Purpose
Unit test suite for JavascriptDebugAdapter connection lifecycle functionality using Vitest framework.

## Test Structure
- **Test Suite**: `JavascriptDebugAdapter.connection` (L15)
- **Setup**: Creates fresh adapter instance with mocked dependencies in `beforeEach` (L18-22)
- **Dependencies**: Minimal stub with mocked logger methods (L6-13)

## Key Test Cases

### Connection Test (L24-33)
- **Purpose**: Validates successful connection establishment
- **Actions**: Calls `adapter.connect('127.0.0.1', 12345)`
- **Assertions**: 
  - `isConnected()` returns true
  - State transitions to `AdapterState.CONNECTED`
  - `connected` event is emitted

### Disconnection Test (L35-46)
- **Purpose**: Validates proper disconnection and cleanup
- **Actions**: Establishes connection then calls `adapter.disconnect()`
- **Assertions**:
  - `isConnected()` returns false
  - Current thread ID is cleared (null)
  - State transitions to `AdapterState.DISCONNECTED`
  - `disconnected` event is emitted

## Dependencies
- **External**: `@debugmcp/shared` for AdapterState enum and AdapterDependencies type
- **Internal**: JavascriptDebugAdapter from main module
- **Testing**: Vitest framework with mocking capabilities

## Patterns
- Event-driven testing using adapter event emitters
- State machine validation through AdapterState transitions
- Mock dependency injection for isolated unit testing
- Fresh adapter instance per test to prevent state leakage