# tests/unit/proxy/proxy-manager.handshake.test.ts
@source-hash: 7dbfe591b71945e6
@generated: 2026-02-10T00:41:36Z

## Purpose
Unit test suite for `ProxyManager.sendInitWithRetry` method functionality, focusing on handshake retry logic and timeout behavior using fake timers.

## Test Structure
- **Test Suite**: `ProxyManager sendInitWithRetry` (L8-119)
- **Setup**: Mock dependencies with Vitest stubs for launcher, filesystem, and logger (L9-33)
- **Test Subject**: `ProxyManager` instance created with mocked dependencies (L35-39)

## Key Mock Objects
- **`launcherStub`** (L9-11): Mock `IProxyProcessLauncher` with `launchProxy` method
- **`fsStub`** (L12-27): Complete mock `IFileSystem` interface with all file operations
- **`loggerStub`** (L28-33): Mock `ILogger` with standard logging methods

## Test Scenarios

### Successful Handshake (L46-62)
Tests immediate acknowledgment within first timeout window:
- Uses fake timers and mocks `sendCommand` to emit `init-received` after 160ms
- Verifies single attempt when acknowledgment arrives before 500ms timeout
- Type assertions access private `sendInitWithRetry` method

### Retry Logic (L64-87)
Tests retry behavior when first attempt times out:
- Simulates late acknowledgment (600ms) on first attempt, immediate (100ms) on retry
- Advances timers through: initial timeout + backoff delay + successful retry
- Verifies exactly 2 attempts made with exponential backoff

### Exhaustion Failure (L89-118)
Tests failure after maximum retry attempts:
- Mocks `sendCommand` with no acknowledgment emission
- Sets `lastExitDetails` with diagnostic information (L95-100)
- Advances through complete timeout sequence: [500, 1000, 2000, 4000, 8000, 8000]ms
- Verifies 6 total attempts before throwing "Failed to initialize proxy" error

## Technical Patterns
- **Type Assertions**: Extensive use of `as unknown as` to access private/internal methods for testing
- **Event-Driven**: Tests rely on `EventEmitter` pattern with `init-received` event
- **Timer Mocking**: Comprehensive fake timer usage with `vi.advanceTimersByTime()` for deterministic async testing
- **Exponential Backoff**: Implements capped exponential backoff strategy in retry logic

## Dependencies
- Vitest testing framework with mocking capabilities
- Node.js EventEmitter for event-driven communication
- `@debugmcp/shared` interfaces for dependency injection