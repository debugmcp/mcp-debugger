# tests/unit/implementations/process-launcher-impl-debug.test.ts
@source-hash: e4a4e574a020bf4f
@generated: 2026-02-10T00:41:46Z

## Primary Purpose

Comprehensive unit test suite for `DebugTargetLauncherImpl` class, testing Python debug target launching capabilities with debugpy integration. Validates process spawning, port allocation, termination handling, and edge cases for debugging Python scripts.

## Test Architecture

**Main Test Class Under Test**: `DebugTargetLauncherImpl` from `process-launcher-impl` (L5-6)

**Key Dependencies**:
- `ProcessLauncherImpl` and `ProcessManagerImpl` for process management (L6-8)
- `INetworkManager` for port allocation (L9)
- `IDebugTarget` interface for debug target contract (L10)

## Mock Infrastructure

**MockChildProcess Interface** (L13-23): Extends EventEmitter with IChildProcess, providing complete child process simulation including streams, kill/send methods, and lifecycle properties.

**createMockProcess Helper** (L26-45): Factory function creating realistic mock processes with:
- Configurable PID (default 12345)
- Simulated kill behavior with exit event emission
- Mock stdin/stdout/stderr streams
- Process state tracking (killed, exitCode, signalCode)

## Test Setup & Teardown

**beforeEach** (L55-70): 
- Initializes fake timers for timeout testing
- Creates fresh mock process and manager instances
- Configures network manager mock with port 5678
- Resets created targets array for cleanup tracking

**afterEach** (L72-83): 
- Cleans up all spawned debug targets
- Restores real timers and clears all mocks
- Ensures no process leakage between tests

## Core Test Categories

### Launch Python Debug Target (L85-236)

**Auto Port Allocation** (L86-111): Verifies debugpy launch with `findFreePort()` call and correct command line assembly including debugpy module, listen address, wait-for-client flag.

**Specific Port Usage** (L113-139): Tests explicit port specification bypassing port allocation, ensuring correct 127.0.0.1:PORT format.

**Custom Python Path** (L141-157): Validates custom Python interpreter usage while maintaining debugpy argument structure.

**Platform-Specific Handling** (L159-174): Windows-only test for path handling (conditional execution).

**Error Scenarios**:
- Port allocation failure (L176-184)
- Invalid Python path with spawn errors (L186-209)

**Command Line Verification** (L211-235): Comprehensive argument order validation for complex debugpy invocations.

### Process Termination (L238-322)

**Graceful Termination** (L239-252): SIGTERM signal usage and process state verification.

**Already Terminated Handling** (L254-267): Idempotent termination behavior for killed processes.

**Force Kill Timeout** (L269-296): SIGKILL escalation after 5-second timeout using fake timers.

**Exit During Termination** (L298-321): Race condition handling when process exits during graceful shutdown.

### Debug Target Properties (L324-360)

**Interface Compliance** (L325-338): Validates IDebugTarget contract with process, debugPort, and terminate method exposure.

**Event Handling** (L340-359): Process event propagation testing for error and exit events.

### Edge Cases (L362-400)

**Path Edge Cases**: 
- Empty dirname handling (L363-377)
- Spaces in paths and arguments (L379-399)

## Critical Test Patterns

**Resource Management**: Systematic cleanup using `createdTargets` array prevents test pollution and process leakage.

**Timer Management**: Fake timer usage enables deterministic timeout testing without real delays.

**Mock Isolation**: Each test gets fresh mocks preventing cross-test interference.

**Error Simulation**: Comprehensive error path coverage including network failures, spawn errors, and process lifecycle issues.

## Key Invariants

- All debug targets use debugpy module with `--wait-for-client` flag
- Default listen address is `127.0.0.1` with allocated or specified port
- Process termination follows graceful-then-force pattern with 5s timeout
- Script arguments are preserved and passed through correctly
- Process cleanup prevents resource leaks between test runs