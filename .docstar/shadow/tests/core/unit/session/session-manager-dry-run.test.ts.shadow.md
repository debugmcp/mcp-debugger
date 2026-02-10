# tests/core/unit/session/session-manager-dry-run.test.ts
@source-hash: 77e4903f7c161e84
@generated: 2026-02-09T18:14:21Z

## Purpose
Test suite focused on race conditions and timing issues in SessionManager's dry run functionality, specifically testing edge cases around event timing, timeouts, and proper cleanup.

## Test Structure
- **Main Test Suite**: `SessionManager - Dry Run Race Condition Tests` (L6)
- **Setup/Teardown**: Fake timers setup (L12) and cleanup (L25-29)
- **Dependencies**: Mock proxy manager and test configuration (L7-23)

## Key Test Cases

### Delayed Dry Run Completion (L32-78)
Tests waiting for dry run completion beyond the default 500ms timeout. Overrides `mockProxyManager.start` to emit `dry-run-complete` after 1000ms delay, verifying the system waits appropriately.

### Timeout Handling (L80-131)
Tests graceful timeout behavior when dry run never completes. Uses shorter 2000ms timeout and verifies failure response with timeout error message.

### Race Condition Handling (L133-174) 
Tests scenario where `dry-run-complete` event fires before event listener setup using `process.nextTick`. Verifies the system can still detect completion by checking state.

### Fast Completion (L176-218)
Tests very fast dry run completion (10ms) to ensure no unnecessary delays are introduced in the happy path.

### Event Listener Cleanup (L220-270)
Tests proper cleanup of event listeners on timeout using spies on `once` and `removeListener` methods to verify listeners are properly removed.

## Key Patterns
- **Mock Override Strategy**: Each test overrides `mockProxyManager.start` to control event timing
- **Timer Manipulation**: Uses `vi.advanceTimersByTimeAsync()` to control time progression
- **Duration Verification**: Measures actual vs expected timing with CI-tolerant bounds
- **State Verification**: Checks both success/failure status and session state transitions

## Dependencies
- **SessionManager**: Main class under test from `session-manager.js`
- **Mock Dependencies**: From `session-manager-test-utils.js` (L4)
- **Shared Types**: `SessionState`, `DebugLanguage` from `@debugmcp/shared` (L3)

## Test Configuration
- Base log directory: `/tmp/test-sessions` (L15)
- Default DAP launch args with `stopOnEntry` and `justMyCode` (L16-19)
- Custom timeout configurations for specific tests (L82, L222)