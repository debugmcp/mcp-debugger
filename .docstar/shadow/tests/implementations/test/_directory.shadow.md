# tests/implementations/test/
@generated: 2026-02-11T23:47:38Z

## Overall Purpose and Responsibility

The `tests/implementations/test` directory provides a comprehensive test infrastructure for process management and debugging functionality. It contains fake/mock implementations of all process-related interfaces that enable deterministic unit testing without spawning real system processes. This module serves as the primary test double layer for process lifecycle management, debug target launching, and proxy process communication.

## Key Components and Architecture

**Process Simulation Layer**
- **FakeProcess** - Core process mock implementing `IProcess` with controllable lifecycle events
- **FakeProxyProcess** - Extended process mock for proxy communication scenarios
- Both use EventEmitter pattern to simulate real Node.js process behavior with deterministic timing

**Launcher Test Doubles**
- **FakeProcessLauncher** - Basic process spawning mock implementing `IProcessLauncher`
- **FakeDebugTargetLauncher** - Python debugging scenario mock with auto-incrementing debug ports
- **FakeProxyProcessLauncher** - Proxy process launcher with automatic command interception and responses

**Factory and Coordination**
- **FakeProcessLauncherFactory** - Centralized factory providing singleton access to all fake launchers
- Implements `IProcessLauncherFactory` interface for seamless substitution in tests

## Public API Surface

**Main Entry Points:**
- `FakeProcessLauncherFactory` - Primary entry point providing access to all launcher mocks
- Factory methods: `getProcessLauncher()`, `getDebugTargetLauncher()`, `getProxyProcessLauncher()`
- Global reset capability via `reset()` method

**Process Control API:**
- Launch methods return controllable process instances with simulate methods
- Test helpers: `simulateOutput()`, `simulateExit()`, `simulateError()`, etc.
- History tracking: `launchedProcesses`, `sentCommands` arrays for verification

**Pre-configuration API:**
- `prepareProcess()`, `prepareTarget()` methods for setting up next launch behavior
- Enables deterministic test scenarios with pre-configured responses

## Internal Organization and Data Flow

**State Management:**
- Each fake maintains internal arrays tracking launched processes/targets/commands
- Deterministic process IDs (12345) and auto-incrementing debug ports (5678+)
- Process state tracking via private fields (`_killed`, `_exitCode`, etc.)

**Event Flow:**
- Async event simulation using `process.nextTick()` to match real process timing
- Command interception in proxy launchers with automatic 'init' command responses
- PassThrough streams for stdin/stdout/stderr simulation

**Test Integration:**
- All fakes implement their corresponding production interfaces exactly
- Reset methods provide clean state between test runs
- History arrays enable comprehensive verification of process interactions

## Important Patterns and Conventions

- **Test Double Pattern** - Complete replacement of real process spawning with controllable fakes
- **Factory Pattern** - Centralized creation and management of all launcher instances  
- **Event Simulation** - Deterministic async behavior matching real Node.js processes
- **Command Interception** - Automatic response handling for common initialization patterns
- **State Isolation** - Each fake maintains independent state with cleanup capabilities

This module enables comprehensive testing of process management workflows without system dependencies, providing full control over process lifecycle events and communication for reliable, fast unit testing.