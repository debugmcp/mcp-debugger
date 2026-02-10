# tests/core/unit/session/session-manager-dry-run.test.ts
@source-hash: 77e4903f7c161e84
@generated: 2026-02-10T00:41:17Z

## Purpose
Test suite specifically focused on dry run race condition scenarios in SessionManager. Tests timing-sensitive behavior around dry run operations, ensuring proper handling of delays, timeouts, race conditions, and event listener cleanup.

## Key Test Structure
- **Test Suite Setup (L6-29)**: Configures fake timers and mock dependencies for controlled timing tests
- **Mock Configuration Pattern**: Each test overrides `mockProxyManager.start` to control dry-run-complete event timing
- **Timing Control**: Uses `vi.advanceTimersByTimeAsync()` to precisely control timer progression

## Core Test Scenarios

### Slow Completion Test (L32-78)
Tests SessionManager's ability to wait beyond the default 500ms timeout for dry run completion. Verifies:
- 1000ms delay handling with proper duration measurement
- Success state with dry run metadata
- Event-driven completion flow

### Timeout Handling Test (L80-131)
Validates graceful timeout when dry-run-complete never fires:
- Custom 2-second timeout configuration
- Failure state with timeout error message
- Proper error reporting with timeout duration

### Race Condition Test (L133-174)
Tests early event emission using `process.nextTick()` to simulate dry-run-complete firing before event listener setup:
- Immediate event emission scenario
- State-based fallback verification
- Race condition resilience

### Fast Completion Test (L176-218)
Verifies efficient handling of very quick (10ms) dry run completion:
- Minimal delay scenarios
- Performance validation (under 100ms total)
- No unnecessary waiting

### Cleanup Test (L220-269)
Ensures proper event listener management on timeout:
- Event listener setup verification via spies
- Cleanup validation using `removeListener` spy
- Memory leak prevention

## Dependencies
- **SessionManager**: Main class under test from `../../../../src/session/session-manager.js`
- **Mock Utilities**: `createMockDependencies()` from `./session-manager-test-utils.js`
- **Shared Types**: `SessionState`, `DebugLanguage` from `@debugmcp/shared`

## Testing Patterns
- **Fake Timer Control**: All tests use `vi.useFakeTimers()` for deterministic timing
- **Mock Proxy Override**: Each test customizes `mockProxyManager.start` behavior
- **Event Emission Control**: Tests precisely control when `dry-run-complete` events fire
- **Duration Validation**: Tests measure actual vs expected timing with CI-friendly tolerances
- **Spy-based Verification**: Uses Vitest spies to verify internal event listener management