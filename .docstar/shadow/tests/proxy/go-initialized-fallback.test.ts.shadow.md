# tests\proxy\go-initialized-fallback.test.ts
@source-hash: 2da73bfa8fdcae7d
@generated: 2026-02-24T01:54:18Z

## Purpose

This test file provides regression tests for Go/Delve two-phase initialized event handling, specifically testing the `sendLaunchBeforeConfig` fallback mechanism in DapProxyWorker when the DAP 'initialized' event arrives after 'launch' instead of before it.

## Architecture

The file tests a specific timing-sensitive issue where Go's Delve debugger adapter protocol (DAP) implementation can send the 'initialized' event in two different timing patterns:
- **Phase 1 (normal)**: 'initialized' arrives immediately after 'initialize' response
- **Phase 2 (fallback)**: 'initialized' only arrives after the 'launch' request is sent

## Key Components

### Mock Factories (L26-82)
- `createMockLogger()` (L26): Creates Vitest-mocked ILogger with info/error/debug/warn methods
- `createMockFileSystem()` (L33): Mocks file system operations with resolved promises
- `createMockProcessSpawner()` (L38): Mocks child process spawning with fake PID and methods
- `createMockDapClient()` (L48): Complex mock combining EventEmitter with IDapClient interface, preserving original event handling while adding mock methods
- `createMockMessageSender()` (L79): Simple mock for message sending

### Test Configuration (L83-98)
- `GO_PAYLOAD` constant: Complete ProxyInitPayload for Go/Delve testing with realistic dlv command configuration

### Test Suite Structure (L102-418)
Four critical test scenarios testing different timing patterns:

1. **Fallback Success Test** (L141-224): Simulates Phase 2 where 'initialized' arrives only after 'launch'. Verifies warning logs, correct DAP sequence ordering, and successful connection state.

2. **Normal Path Test** (L230-295): Tests Phase 1 happy path where 'initialized' arrives immediately after 'initialize'. Verifies no fallback warnings appear.

3. **Timeout Test** (L301-348): Uses fake timers to test 10-second Phase 2 timeout when 'initialized' never arrives. Expects specific timeout error message.

4. **Regression Guard Test** (L357-418): **Critical timing test** - fires 'initialized' at 3 seconds to ensure Phase 1 timeout is 2s (not reverted to 5s). If timeout were 5s, this event would be caught by Phase 1, making fallback warnings disappear and breaking the test.

## Test Implementation Patterns

### Dependency Injection Setup
Each test creates complete mock dependency graph and injects into DapProxyWorker via `(worker as any)` property access, bypassing encapsulation for internal state manipulation.

### Call Order Tracking
Tests use `callOrder` arrays to verify proper DAP protocol sequence: initialize → launch → configurationDone.

### Timer Management
Uses Vitest fake timers (`vi.useFakeTimers()`, `vi.advanceTimersByTimeAsync()`) for precise timeout behavior testing, with proper cleanup in afterEach.

## Critical Invariants

- Phase 1 timeout must be exactly 2 seconds (verified by regression guard test)
- Phase 2 timeout is 10 seconds total
- DAP protocol ordering must be preserved in both phases
- Specific log messages must appear for each phase transition
- Final state must be `ProxyState.CONNECTED` on success

## Dependencies

- **DapProxyWorker**: Main class under test from dap-proxy-worker.js
- **GoAdapterPolicy**: Go-specific adapter behavior from @debugmcp/shared
- **ProxyState enum**: State management from dap-proxy-interfaces.js
- **Vitest**: Test framework with mocking and fake timer capabilities