# tests/unit/adapters/js-debug-launch-barrier.test.ts
@source-hash: be7ac58af6a0a6cc
@generated: 2026-02-10T00:41:30Z

## Purpose
Unit test file for `JsDebugLaunchBarrier` utility that validates launch readiness detection for JavaScript debugging adapters.

## Test Structure
- **Mock Logger Factory** (L4-9): Creates vitest mocks for logger methods (info, warn, error, debug)
- **Test Suite Setup** (L11-22): Configures fake timers and fresh logger mocks per test
- **Core Test Class**: `JsDebugLaunchBarrier` from `../../../packages/adapter-javascript/src/utils/js-debug-launch-barrier.js`

## Key Test Scenarios

### Readiness Detection Tests
- **Stopped Event Resolution** (L24-33): Verifies barrier resolves immediately when DAP 'stopped' event is received, logs successful launch confirmation
- **Adapter Connected Resolution** (L35-45): Tests resolution after 'adapter_connected' proxy status with 500ms delay, logs adapter readiness
- **Timeout Fallback** (L47-56): Validates timeout behavior (1500ms) when no events arrive, logs warning and proceeds

### Error Handling Tests  
- **Proxy Exit Rejection** (L58-66): Ensures barrier rejects with error when proxy exits before launch completion
- **Duplicate Signal Handling** (L68-81): Confirms barrier ignores subsequent readiness signals after initial settlement, preventing duplicate logging

## Testing Patterns
- Uses vitest fake timers for time-based testing
- Mock logger validation for proper logging behavior
- Promise-based assertions for async barrier operations
- Proper cleanup with `barrier.dispose()` calls
- Timer advancement with `vi.advanceTimersByTimeAsync()`

## Dependencies
- **vitest**: Testing framework with mocking and timer utilities
- **JsDebugLaunchBarrier**: The class under test for launch barrier coordination

## Test Coverage
Covers all major barrier states: immediate resolution via events, delayed resolution via status, timeout fallback, error conditions, and duplicate signal handling.