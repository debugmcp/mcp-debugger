# tests/unit/implementations/process-launcher-impl-base.test.ts
@source-hash: e25da14540d8f81e
@generated: 2026-02-09T18:14:46Z

## Unit Tests for ProcessLauncher Implementation

Comprehensive test suite for the process launcher implementation components, covering process lifecycle management, event handling, and factory pattern implementations.

### Test Structure & Setup

**Test Configuration (L1-10)**: Uses Vitest framework with EventEmitter for mocking Node.js child processes. Imports core implementations: `ProcessLauncherImpl`, `ProcessLauncherFactoryImpl`, and `ProcessManagerImpl`.

**MockChildProcess Interface (L12-22)**: Extends EventEmitter and IChildProcess to provide complete process simulation including PID, streams (stdin/stdout/stderr), lifecycle state (killed, exitCode, signalCode), and control methods (kill, send).

**Mock Factory Function (L25-44)**: `createMockProcess()` generates realistic child process mocks with proper event emission, kill signal handling, and stream simulation. Implements async exit behavior using `process.nextTick()`.

### Test Fixtures & Lifecycle

**Setup/Teardown (L52-74)**: 
- Uses fake timers for deterministic async testing
- Creates fresh mock process and ProcessManagerImpl for each test
- Tracks created processes for cleanup
- Ensures proper resource cleanup and timer restoration

### Core Test Categories

**Basic Process Launch (L76-97)**: Validates fundamental process creation with correct parameter passing, PID assignment, and stream access through the ProcessLauncher abstraction.

**Event Forwarding (L99-163)**: Comprehensive testing of event propagation from child process to wrapper:
- Exit events with code/signal tracking (L100-112)
- Close, error, spawn, and message event forwarding (L114-162)
- Proper state updates (exitCode, signalCode) on process termination

**Process Control (L165-196)**: Tests IPC and lifecycle management:
- Message sending via `send()` method (L166-175)
- Process termination with and without signals (L177-195)

**Edge Cases (L198-284)**: Robust error handling scenarios:
- Double-kill protection (L199-209) 
- Message sending to dead processes (L211-228)
- Race conditions during process exit (L230-259)
- Null exit code/signal handling (L272-283)

### Factory Pattern Tests

**ProcessLauncherFactoryImpl (L286-321)**: Validates factory methods for creating specialized launchers:
- Basic process launcher creation (L287-296)
- Debug target launcher with Python debugging capabilities (L298-308)  
- Proxy process launcher for network proxying (L310-320)

### Key Testing Patterns

- **Mock Isolation**: Each test uses fresh mocks to prevent cross-test contamination
- **Async Event Testing**: Uses `vi.runAllTimersAsync()` for deterministic async behavior testing
- **Resource Tracking**: Maintains `createdProcesses` array for proper cleanup
- **State Verification**: Validates both method return values and internal state changes
- **Edge Case Coverage**: Tests failure modes, race conditions, and boundary conditions