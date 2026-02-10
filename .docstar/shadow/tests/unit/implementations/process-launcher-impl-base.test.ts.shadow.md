# tests/unit/implementations/process-launcher-impl-base.test.ts
@source-hash: e25da14540d8f81e
@generated: 2026-02-10T00:41:35Z

## Purpose
Unit test suite for `ProcessLauncherImpl` and `ProcessLauncherFactoryImpl` classes, verifying process launching, event forwarding, and inter-process communication functionality.

## Test Structure
- **Mock Setup (L12-44)**: `MockChildProcess` interface and `createMockProcess()` helper for realistic child process simulation
- **Test Suite Setup (L46-74)**: BeforeEach/afterEach hooks with fake timers and process cleanup
- **Core Test Groups**:
  - Basic Process Launch (L76-97): Parameter validation and stream access
  - Event Forwarding (L99-163): Exit, close, error, spawn, and message event propagation
  - Process Control (L165-196): Message sending and process termination
  - Edge Cases (L198-284): Error conditions and race scenarios
  - Factory Tests (L286-321): Factory method validation

## Key Components
- **MockChildProcess (L12-22)**: Extended EventEmitter implementing `IChildProcess` interface with process control methods
- **createMockProcess() (L25-44)**: Factory function creating fully-featured mock processes with realistic kill/send behavior
- **Test Fixtures (L47-50)**: `ProcessLauncherImpl`, `ProcessManagerImpl`, and process tracking array

## Mock Behavior Patterns
- **Process Lifecycle**: Mock kill() triggers async exit event emission (L31-38)
- **State Management**: Killed processes return false on subsequent operations (L32-34, L216-218)
- **Stream Simulation**: Stdin/stdout/stderr as EventEmitters for testing (L40-42)

## Test Coverage Areas
1. **Process Creation**: Command, arguments, and options passing validation
2. **Event System**: Complete event forwarding from child process to wrapper
3. **IPC**: Message sending with proper return value handling
4. **Process Control**: Signal-based termination and state tracking
5. **Error Handling**: Dead process operations and race conditions
6. **Factory Methods**: All three factory creation methods (`createProcessLauncher`, `createDebugTargetLauncher`, `createProxyProcessLauncher`)

## Critical Test Scenarios
- **Race Condition Testing (L230-259)**: Process exit during message send operations
- **State Consistency (L199-209)**: Multiple kill attempts on same process
- **Null Handling (L272-283)**: Exit codes and signal codes can be null

## Dependencies
- Vitest testing framework with mocking capabilities
- EventEmitter for mock process simulation
- Real ProcessManagerImpl and ProcessLauncherImpl under test