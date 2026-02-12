# tests\implementations\test/
@generated: 2026-02-12T21:00:53Z

## Overall Purpose

This directory provides comprehensive test infrastructure for process management and debugging functionality. It contains fake implementations of all process-related interfaces that enable deterministic, controllable unit testing without spawning real processes or external dependencies.

## Key Components and Architecture

The module is built around a hierarchical set of test doubles that mirror the production process management system:

**Process Layer**
- `FakeProcess` - Core EventEmitter-based process mock implementing `IProcess`
- `FakeProxyProcess` - Extended process mock for proxy scenarios implementing `IProxyProcess`

**Launcher Layer**
- `FakeProcessLauncher` - Basic process launcher test double
- `FakeDebugTargetLauncher` - Specialized launcher for Python debugging scenarios
- `FakeProxyProcessLauncher` - Proxy process launcher with auto-response capabilities

**Factory Layer**
- `FakeProcessLauncherFactory` - Centralized factory providing singleton instances of all fake launchers

## Public API Surface

**Primary Entry Points:**
- `FakeProcessLauncherFactory` - Main factory for obtaining all launcher instances
- Individual launcher classes for direct instantiation in specific test scenarios

**Key Testing Methods:**
- `launch()` / `launchPythonDebugTarget()` / `launchProxy()` - Process creation methods
- `simulate*()` methods - Control process lifecycle events (output, errors, exit, spawn)
- `prepare*()` methods - Pre-configure next process/target behavior
- `reset()` methods - Clean up state between tests

## Internal Organization and Data Flow

The architecture follows a factory pattern where `FakeProcessLauncherFactory` provides access to all launcher types. Each launcher maintains:

1. **Launch History** - Arrays tracking all launched processes/targets with full configuration
2. **State Management** - Current process states and controllable behavior
3. **Event Simulation** - Async event emission using `process.nextTick()` for realistic timing

Data flows from launcher configuration → process creation → controllable event emission → test verification.

## Important Patterns and Conventions

**Test Double Pattern** - All fakes provide deterministic behavior without external dependencies

**Event-Driven Simulation** - Uses Node.js EventEmitter pattern with `process.nextTick()` for realistic async behavior

**Command Interception** - `FakeProxyProcessLauncher` automatically responds to 'init' commands, simulating real proxy initialization

**Deterministic Defaults** - Consistent process IDs (12345), auto-incrementing debug ports (5678+), predictable responses

**Centralized Cleanup** - Factory-level `reset()` method clears all launcher states for test isolation

**History Tracking** - All launchers maintain arrays of launched processes/targets for test verification

This module enables comprehensive testing of process management workflows including basic process launching, Python debugging, and proxy process communication without the complexity and non-determinism of real process spawning.