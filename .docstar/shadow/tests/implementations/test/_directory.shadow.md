# tests/implementations/test/
@generated: 2026-02-10T01:19:36Z

## Overall Purpose and Responsibility

This test implementation module provides a comprehensive suite of fake/mock implementations for all process-related interfaces in the system. It enables deterministic unit testing of process management code without spawning real processes, offering controllable simulation of process lifecycles, debugging scenarios, and proxy communications.

## Key Components and Relationships

The module follows a layered architecture mirroring the production process interfaces:

**Core Process Layer**
- `FakeProcess` - Base process mock implementing `IProcess` with controllable lifecycle events
- `FakeProcessLauncher` - Creates and tracks FakeProcess instances

**Debug Target Layer** 
- `FakeDebugTargetLauncher` - Specialized launcher for Python debugging scenarios with auto-incrementing debug ports

**Proxy Process Layer**
- `FakeProxyProcess` - Extended process mock with command tracking and initialization simulation
- `FakeProxyProcessLauncher` - Launches proxy processes with automatic 'init' command responses

**Factory Layer**
- `FakeProcessLauncherFactory` - Centralized factory providing singleton access to all fake launchers

## Public API Surface

**Primary Entry Points:**
- `FakeProcessLauncherFactory` - Main factory for obtaining all launcher instances
- Individual launcher classes can be instantiated directly for isolated testing

**Key Methods:**
- `launch()` / `launchPythonDebugTarget()` / `launchProxy()` - Process creation methods
- `simulate*()` methods on FakeProcess - Control process behavior (output, errors, exit, etc.)
- `prepare*()` methods - Pre-configure next process/target behavior
- `reset()` methods - Clean state for test isolation

## Internal Organization and Data Flow

**State Management:**
- Each fake maintains internal arrays tracking launched processes/targets
- Process state managed through private fields (`_killed`, `_exitCode`, `_signalCode`)
- Automatic ID generation (process IDs, debug ports) for realistic simulation

**Event Flow:**
- EventEmitter-based async simulation using `process.nextTick()` for realistic timing
- Automatic response interception in proxy launchers for 'init' commands
- Stream-based I/O simulation using PassThrough streams

**Test Orchestration:**
- Centralized reset capability across all fakes via factory
- Launch history tracking for test verification
- Pre-configuration support for deterministic test scenarios

## Important Patterns and Conventions

**Test Double Pattern:** All implementations are controllable fakes rather than stubs, providing rich simulation capabilities while maintaining deterministic behavior.

**Factory Pattern:** Centralized access to all fakes with singleton management for consistent test state.

**Event Simulation:** Realistic async behavior through EventEmitter patterns matching Node.js process APIs.

**Command Interception:** Automatic response generation for common initialization patterns, reducing test setup complexity.

**Deterministic Defaults:** Fixed process IDs (12345) and predictable port allocation for consistent test execution.