# tests\implementations/
@generated: 2026-02-12T21:01:04Z

## Overall Purpose and Responsibility

The `tests/implementations` directory provides a comprehensive test infrastructure for process management and debugging functionality. It contains fake implementations that replace all process-related interfaces with deterministic, controllable test doubles, enabling reliable unit testing without spawning real processes or requiring external dependencies.

## Key Components and Integration

The module implements a three-tiered architecture that mirrors the production process management system:

**Process Layer** - Core process abstractions:
- `FakeProcess` - EventEmitter-based mock implementing `IProcess`
- `FakeProxyProcess` - Extended process mock for proxy scenarios implementing `IProxyProcess`

**Launcher Layer** - Process creation and management:
- `FakeProcessLauncher` - Basic process launcher test double
- `FakeDebugTargetLauncher` - Specialized launcher for Python debugging scenarios
- `FakeProxyProcessLauncher` - Proxy process launcher with auto-response capabilities

**Factory Layer** - Centralized access point:
- `FakeProcessLauncherFactory` - Singleton factory providing access to all fake launchers

These components work together through a factory pattern where the factory provides configured launcher instances, launchers create and manage fake processes, and processes emit controllable events for test verification.

## Public API Surface

**Primary Entry Point:**
- `FakeProcessLauncherFactory` - Main factory for obtaining all launcher test doubles

**Core Testing Interface:**
- `launch()` / `launchPythonDebugTarget()` / `launchProxy()` - Process creation methods
- `simulate*()` methods - Control process lifecycle events (output, errors, exit, spawn)
- `prepare*()` methods - Pre-configure next process/target behavior
- `reset()` methods - Clean up state between tests

## Internal Organization and Data Flow

The architecture follows a centralized factory pattern with distributed state management:

1. **Factory Access** - `FakeProcessLauncherFactory` provides singleton access to all launcher types
2. **Launch Configuration** - Launchers capture and store all launch parameters for verification
3. **Process Simulation** - Created processes emit events using `process.nextTick()` for realistic async behavior
4. **State Tracking** - Each launcher maintains launch history and controllable behavior state

## Important Patterns and Conventions

**Deterministic Test Doubles** - All fakes provide predictable, controllable behavior without external dependencies

**Event-Driven Architecture** - Uses Node.js EventEmitter pattern with async event simulation for realistic testing

**Command Auto-Response** - Proxy launchers automatically handle initialization commands to simulate real proxy behavior

**Consistent Defaults** - Standardized process IDs (12345), auto-incrementing debug ports (5678+), and predictable responses

**Centralized State Management** - Factory-level reset capability ensures clean test isolation

**Comprehensive History Tracking** - All launchers maintain detailed records of launched processes for test verification

This test infrastructure enables thorough testing of complex process management workflows including basic process launching, Python debugging, and proxy process communication while maintaining test reliability and performance.