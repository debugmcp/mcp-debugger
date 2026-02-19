# tests\core\unit\session\session-manager-memory-leak.test.ts
@source-hash: fc8e19a38fb794fa
@generated: 2026-02-19T23:47:39Z

**Test Suite**: SessionManager Memory Leak Prevention

This file tests event listener cleanup in SessionManager to prevent memory leaks. Uses vitest with mocked dependencies and fake timers.

## Test Structure

**Main Setup (L15-33)**: Creates SessionManager with mock dependencies and test configuration for each test. Uses `createMockDependencies()` utility and fake timers.

## Core Test Groups

### Event Listener Cleanup (L35-208)
Tests proper removal of event listeners when sessions are closed or terminated:

- **Single Session Cleanup (L36-73)**: Verifies all event listeners ('stopped', 'continued', 'terminated', 'exited', 'initialized', 'error', 'exit', 'adapter-configured', 'dry-run-complete') are removed after closing a session
- **Multiple Session Test (L75-99)**: Creates/closes 10 sessions in sequence, ensures no listener accumulation
- **Error Resilience (L101-124)**: Tests cleanup continues even when proxyManager.stop() throws
- **Double Close Handling (L126-155)**: Verifies graceful handling of closing same session twice
- **Unexpected Termination (L157-181)**: Tests cleanup on 'terminated' event, session moves to STOPPED state
- **Unexpected Exit (L183-207)**: Tests cleanup on 'exit' event with error code, session moves to ERROR state

### Cleanup Method Testing (L210-260)
Tests internal cleanup mechanisms:

- **Internal Method (L211-233)**: Tests `_testOnly_cleanupProxyEventHandlers` if available
- **Logging Verification (L235-259)**: Ensures cleanup operations are properly logged

### Edge Cases (L262-341)
Tests boundary conditions:

- **No Handlers (L263-271)**: Closing session without starting debugging
- **Partial Failure (L273-308)**: Handles removeListener errors gracefully, logs errors but continues cleanup
- **Session Store Management (L310-327)**: Verifies sessions removed from store after close
- **Session Retrieval (L329-340)**: Confirms getSession returns undefined after close

## Key Dependencies
- `SessionManager` from session-manager.js (L6)
- `DebugLanguage`, `SessionState` from @debugmcp/shared (L7)
- Mock utilities from session-manager-test-utils.js (L8)

## Test Patterns
- Extensive use of listener counting via `mockProxy.listenerCount()`
- Timer advancement with `vi.runAllTimersAsync()`
- Error injection through mock function replacement
- State verification through session retrieval

Critical for ensuring SessionManager doesn't leak memory through unremoved event listeners during session lifecycle operations.