# tests/unit/proxy/proxy-manager.handshake.test.ts
@source-hash: 7dbfe591b71945e6
@generated: 2026-02-09T18:14:43Z

## ProxyManager Handshake Test Suite

**Purpose**: Unit tests for ProxyManager's `sendInitWithRetry` method, which handles initialization handshake with proxy processes using timeout-based retry logic.

### Test Architecture
- **Test Suite** (L8): Focused on `sendInitWithRetry` method behavior
- **Mock Dependencies** (L9-33): Complete stubs for IProxyProcessLauncher, IFileSystem, and ILogger interfaces
- **Test Setup** (L37-44): Fresh ProxyManager instance per test with mock restoration

### Core Test Scenarios

**Successful First Attempt** (L46-62)
- Tests immediate acknowledgment within 500ms timeout window
- Uses fake timers to control timing precisely
- Mocks `sendCommand` to emit 'init-received' event after 160ms
- Verifies single attempt succeeds

**Retry Logic** (L64-87) 
- Tests timeout-triggered retry mechanism
- First attempt times out (600ms delay > 500ms timeout)
- Second attempt succeeds quickly (100ms delay)
- Validates exponential backoff with 500ms delay between retries
- Confirms exactly 2 sendCommand calls

**Exhaustion Failure** (L89-118)
- Tests complete retry exhaustion scenario
- Mocks never-responding proxy process
- Sets up `lastExitDetails` with error context (L95-100)
- Tests full timeout progression: [500, 1000, 2000, 4000, 8000, 8000]ms
- Expects rejection with "Failed to initialize proxy" error
- Validates 6 total retry attempts

### Key Implementation Details
- Uses Vitest fake timers for deterministic timeout testing
- Accesses private methods via type casting (`manager as unknown as ...`)
- Relies on EventEmitter pattern for 'init-received' acknowledgments
- Tests exponential backoff with cap at 8000ms timeout