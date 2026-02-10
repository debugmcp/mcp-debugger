# tests/unit/proxy/dap-proxy-request-tracker.test.ts
@source-hash: 4ff829a22f8355c7
@generated: 2026-02-10T00:41:33Z

## Purpose
Unit test suite for RequestTracker and CallbackRequestTracker classes from the DAP (Debug Adapter Protocol) proxy module. Tests request tracking, timeout handling, and callback mechanisms for debugging session management.

## Test Structure

### RequestTracker Tests (L8-164)
Primary test suite covering the base RequestTracker functionality:

**Setup (L11-18)**: Uses Vitest fake timers with 1-second default timeout for controlled timing tests.

**Core Methods Tested:**
- `track()` (L20-71): Tests request registration, ID collision handling, custom timeouts, and automatic timeout cleanup
- `complete()` (L73-97): Tests request completion, timeout clearing, and error handling for non-existent requests  
- `clear()` (L99-127): Tests bulk removal of all pending requests and associated timeouts
- `getPending()` (L129-143): Tests immutable copy semantics of pending request map
- `getElapsedTime()` (L145-163): Tests time tracking for active requests

### CallbackRequestTracker Tests (L166-225)
Extended test suite for callback-enabled request tracking:

**Setup (L170-178)**: Creates mock timeout callback function with fake timers.

**Callback Behavior Tests:**
- Timeout callback invocation (L180-191): Verifies callback is triggered with correct parameters after timeout
- Callback prevention (L193-201): Ensures completed requests don't trigger callbacks
- Multiple timeout handling (L203-224): Tests concurrent timeouts with different durations

## Key Test Patterns

### Timing Control
Uses `vi.advanceTimersByTime()` and `vi.setSystemTime()` for deterministic timeout testing without actual delays.

### State Verification
Consistently checks `isPending()`, `getPendingCount()`, and internal state after operations to ensure proper lifecycle management.

### Error Handling
Tests graceful handling of operations on non-existent requests without throwing exceptions.

## Dependencies
- **Vitest** (L5): Test framework with mocking and fake timer capabilities
- **Source Module** (L6): Imports RequestTracker and CallbackRequestTracker from `../../../src/proxy/dap-proxy-request-tracker.js`

## Test Data
Uses string-based request IDs (`'req-1'`, `'req-2'`, etc.) and DAP command names (`'continue'`, `'evaluate'`, `'setBreakpoints'`) as test fixtures.