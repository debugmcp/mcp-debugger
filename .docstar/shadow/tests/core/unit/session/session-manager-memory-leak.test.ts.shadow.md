# tests/core/unit/session/session-manager-memory-leak.test.ts
@source-hash: f0ec2d4174b06973
@generated: 2026-02-10T00:41:22Z

## Primary Purpose

Memory leak prevention test suite for SessionManager, focusing on proper event listener cleanup to prevent memory accumulation during session lifecycle operations.

## Test Structure

**Main Test Suite (L10-310):** SessionManager memory leak prevention tests with three primary categories:

### Event Listener Cleanup Tests (L35-208)

**Basic Cleanup Verification (L36-73):** Tests that all event listeners are properly removed when closing a session
- Creates session with mock dependencies 
- Starts debugging to attach event listeners for: 'stopped', 'continued', 'terminated', 'exited', 'initialized', 'error', 'exit', 'adapter-configured', 'dry-run-complete' (L48-50)
- Verifies listeners are attached before cleanup (L58-63)
- Confirms all listeners are removed after session close (L70-72)

**Accumulation Prevention (L75-99):** Ensures listeners don't accumulate across multiple session lifecycles
- Creates and closes 10 sessions in sequence (L80-92)
- Verifies total listener count remains zero after all sessions closed (L95-98)

**Error Handling During Cleanup (L101-124):** Tests cleanup robustness when proxyManager.stop() fails
- Mocks proxyManager.stop() to throw error (L113)
- Confirms listeners are still removed despite stop() failure (L120-123)

**Double Close Protection (L126-155):** Validates graceful handling of multiple close calls
- Closes same session twice (L138, L146)
- Ensures second close doesn't throw and listener count remains zero (L146, L153-154)

**Unexpected Termination Handling (L157-181):** Tests cleanup on proxy termination events
- Simulates 'terminated' event (L169)
- Verifies listeners removed and session state becomes STOPPED (L173-180)

**Unexpected Exit Handling (L183-207):** Tests cleanup on proxy exit events
- Simulates process exit with code/signal (L195)
- Verifies listeners removed and session state becomes ERROR (L199-206)

### Cleanup Method Testing (L210-260)

**Internal Method Access (L211-233):** Tests direct access to cleanup methods
- Calls internal `_testOnly_cleanupProxyEventHandlers` if available (L227-228)
- Verifies direct listener removal (L231)

**Cleanup Logging (L235-259):** Validates proper logging during cleanup operations
- Monitors debug/info log calls during session close (L244-245, L247-248)
- Confirms logging of listener removal and cleanup completion (L254-258)

### Edge Cases (L262-309)

**No Handlers Scenario (L263-271):** Tests cleanup when no event handlers were attached
- Closes session without starting debugging (L270)

**Partial Failure Handling (L273-308):** Tests resilience when some listener removals fail
- Mocks removeListener to fail for 'stopped' event (L285-291)
- Confirms other listeners still removed and errors logged (L300-307)

## Key Dependencies

- **SessionManager (L6):** Main class under test from session module
- **Mock Dependencies (L8, L17):** Test utilities providing mockProxyManager and logger
- **Vitest Framework (L5):** Testing library with timer mocking capabilities (L16, L30)
- **DebugLanguage/SessionState (L7):** Shared enums for session configuration

## Test Configuration

**Setup (L15-27):** 
- Fake timers with advancement enabled (L16)
- Mock dependencies creation (L17)
- Test configuration with log directory and DAP launch args (L18-24)
- SessionManager instantiation (L26)

**Teardown (L29-33):**
- Real timers restoration (L30)
- Mock clearing and proxy manager reset (L31-32)

## Critical Test Patterns

**Listener Count Verification:** Consistent pattern of checking listener counts before/after operations using `mockProxy.listenerCount()` and `eventNames().reduce()`

**Async Operations:** All session operations use await with `vi.runAllTimersAsync()` for proper async handling

**Error Simulation:** Strategic mocking of methods to throw errors for robustness testing

**State Validation:** Session state verification after unexpected termination/exit events