# tests/core/unit/session/session-manager-state.test.ts
@source-hash: e235bed449d199c5
@generated: 2026-02-10T00:41:19Z

## Purpose
Unit test suite for SessionManager state machine integrity, ensuring proper state transitions and error handling in the debug session lifecycle.

## Test Structure
- **Test suite** (L10): "SessionManager - State Machine Integrity" - validates state machine behavior
- **Setup/teardown** (L15-33): Configures fake timers, mock dependencies, and SessionManager instance
- **Mock dependencies** (L17): Uses `createMockDependencies()` for isolated testing
- **Configuration** (L18-24): Test config with `/tmp/test-sessions` log directory and DAP launch args

## Key Test Cases

### Valid State Transitions (L35-60)
Tests the expected state flow:
- CREATED → INITIALIZING (L42-43): Starting debugging triggers transition
- INITIALIZING → PAUSED (L48-49): With `stopOnEntry=true` default
- PAUSED → RUNNING (L51-55): Via `continue()` operation  
- RUNNING → STOPPED (L58-59): Via `closeSession()`

### Invalid Operations (L62-86)
Validates state-based operation restrictions:
- **Pre-start operations** (L69): `stepOver()` throws `ProxyNotRunningError` when session not started
- **Running state restrictions** (L78-80): `stepOver()` returns `{success: false, error: 'Not paused'}`
- **Non-paused restrictions** (L83-85): `continue()` returns error when not paused

### Error State Handling (L88-106)
Tests state consistency during failures:
- **Error transition** (L101-104): Runtime errors transition session to ERROR state
- **Resource cleanup** (L105): `proxyManager` becomes undefined in error state

## Dependencies
- **SessionManager** (L5): Main class under test from `../../../../src/session/session-manager.js`
- **DebugLanguage, SessionState** (L6): Enums from `@debugmcp/shared`
- **ProxyNotRunningError** (L8): Typed error from debug-errors module
- **Mock utilities** (L7): Test helpers for dependency injection

## Testing Patterns
- **Fake timers** (L16, 30): Controls async timing with `vi.useFakeTimers()`
- **Mock simulation** (L52, 54, 75, 98): Uses `mockProxyManager` to simulate debug events
- **State assertions** (L43, 49, 55, 59): Validates state transitions at each step
- **Error validation** (L69, 78-80, 83-85): Tests both exceptions and error results