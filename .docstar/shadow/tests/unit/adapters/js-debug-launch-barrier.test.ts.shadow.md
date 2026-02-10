# tests/unit/adapters/js-debug-launch-barrier.test.ts
@source-hash: be7ac58af6a0a6cc
@generated: 2026-02-09T18:14:40Z

## Purpose
Unit test suite for the `JsDebugLaunchBarrier` class, verifying its async readiness detection behavior during JavaScript debug adapter launches. Tests the barrier's ability to resolve via multiple pathways: DAP stopped events, proxy connection status, timeout fallback, and error handling.

## Test Structure
- **Test suite**: `JsDebugLaunchBarrier` (L11-82)
- **Mock logger factory**: `createLogger()` (L4-9) - Creates stub logger with vitest mocks for all log levels
- **Setup/teardown**: Uses fake timers (L15, L20) and mock clearing (L21) for deterministic async testing

## Key Test Scenarios

### Happy Path Tests
- **Stopped event resolution** (L24-33): Verifies barrier resolves immediately when DAP 'stopped' event arrives, logs confirmation message
- **Adapter connected resolution** (L35-45): Tests resolution 500ms after 'adapter_connected' proxy status, with appropriate logging
- **Timeout fallback** (L47-56): Ensures barrier resolves gracefully after timeout (1500ms), logs warning message

### Error Handling
- **Proxy exit rejection** (L58-66): Verifies barrier rejects with specific error when proxy exits before readiness
- **Duplicate signal handling** (L68-81): Confirms barrier ignores additional readiness signals after initial settlement

## Dependencies
- **Vitest testing framework**: Mock functions, fake timers, async test utilities
- **Target class**: `JsDebugLaunchBarrier` from `../../../packages/adapter-javascript/src/utils/js-debug-launch-barrier.js`

## Test Patterns
- Consistent barrier instantiation with logger and timeout parameters
- Promise-based testing with `waitUntilReady()` method
- Timer manipulation via `vi.advanceTimersByTimeAsync()` for timeout scenarios
- Proper cleanup with `barrier.dispose()` in all tests
- Mock verification for logging behavior validation