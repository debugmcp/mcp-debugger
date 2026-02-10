# tests/unit/proxy/dap-proxy-request-tracker.test.ts
@source-hash: 4ff829a22f8355c7
@generated: 2026-02-09T18:14:43Z

## Purpose
Unit test suite for the DAP (Debug Adapter Protocol) proxy request tracking system, validating the behavior of `RequestTracker` and `CallbackRequestTracker` classes for managing pending debug requests with timeout handling.

## Test Structure
- **RequestTracker tests (L8-164)**: Core functionality testing for basic request lifecycle management
- **CallbackRequestTracker tests (L166-225)**: Extended functionality testing with timeout callback behavior

## Key Test Coverage

### RequestTracker Core Features
- **Request tracking (L20-71)**: Tests basic request lifecycle including adding, replacing, and automatic timeout removal
- **Request completion (L73-97)**: Validates proper cleanup of completed requests and timeout clearing
- **Bulk operations (L99-127)**: Tests clearing all pending requests and timeout management
- **State inspection (L129-163)**: Validates getter methods and elapsed time calculation

### CallbackRequestTracker Extended Features  
- **Timeout callbacks (L180-191)**: Ensures callback invocation on timeout with proper parameters
- **Callback prevention (L193-201)**: Validates callbacks don't fire for completed requests
- **Multiple timeout handling (L203-224)**: Tests concurrent request timeouts with selective completion

## Test Infrastructure
- **Mock timer setup (L12-18, L171-178)**: Uses Vitest fake timers for deterministic timeout testing
- **Callback mocking (L168, L172)**: Mock function for verifying timeout callback behavior
- **Test data**: Uses request IDs like 'req-1', 'req-2' and DAP commands like 'continue', 'evaluate', 'setBreakpoints'

## Critical Test Patterns
- Timer advancement with `vi.advanceTimersByTime()` for timeout simulation
- State verification through `isPending()`, `getPendingCount()`, and `getPending()` methods
- Timeout behavior validation with 1000ms default timeouts and custom timeout testing
- Immutability testing for returned data structures (L139-141)

## Dependencies
- Vitest testing framework for mocking and assertions
- Target classes: `RequestTracker` and `CallbackRequestTracker` from `dap-proxy-request-tracker.js`