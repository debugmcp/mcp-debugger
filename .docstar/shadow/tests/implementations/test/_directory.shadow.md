# tests\implementations\test/
@children-hash: 35148f1e4c88a4ed
@generated: 2026-02-15T09:01:25Z

## Overall Purpose
This directory provides comprehensive test doubles and fake implementations for all process management interfaces in the system. It enables deterministic, controllable unit testing of process-launching functionality without spawning actual processes or external dependencies.

## Key Components and Integration
The module consists of hierarchical fake implementations that mirror the production process management architecture:

- **FakeProcess** - Core process simulation with EventEmitter-based lifecycle events
- **FakeProcessLauncher** - Basic process launching with command/argument tracking
- **FakeDebugTargetLauncher** - Specialized Python debugging process launcher with port management
- **FakeProxyProcess** - Extended process mock with command interception capabilities
- **FakeProxyProcessLauncher** - Proxy-specific launcher with automatic initialization handling
- **FakeProcessLauncherFactory** - Centralized factory providing singleton instances of all fakes

These components work together to provide a complete test environment that matches the real process management interfaces while offering full control over process behavior.

## Public API Surface
**Primary Entry Points:**
- `FakeProcessLauncherFactory` - Main factory for obtaining all fake launcher instances
- `FakeProcessLauncher.launch()` - Creates controllable process instances
- `FakeDebugTargetLauncher.launchPythonDebugTarget()` - Creates debug targets with auto-assigned ports
- `FakeProxyProcessLauncher.launchProxy()` - Creates proxy processes with initialization handling

**Test Control Methods:**
- `simulate*()` methods on FakeProcess - Control process lifecycle events (output, errors, exit)
- `prepare*()` methods on launchers - Pre-configure next launch behavior
- `reset()` methods - Clean state for test isolation
- History tracking arrays - Verify launched processes and sent commands

## Internal Organization and Data Flow
The architecture follows a layered approach:
1. **Base Layer**: FakeProcess provides fundamental process simulation with streams and event emission
2. **Launcher Layer**: Various launcher fakes create and manage process instances
3. **Factory Layer**: Centralized factory coordinates all launcher instances
4. **Test Control Layer**: Simulation methods and state tracking enable test orchestration

Data flows from test code through launcher interfaces to fake process instances, with full bidirectional control over process communication via streams and events.

## Key Testing Patterns
- **Deterministic Behavior**: Fixed PIDs (12345) and predictable port assignment (starting at 5678)
- **Event Simulation**: Async event emission using `process.nextTick()` to match real Node.js behavior
- **Command Interception**: Automatic responses to common commands (e.g., 'init' in proxy processes)
- **State Verification**: Comprehensive tracking of launches, commands, and process interactions
- **Test Isolation**: Reset methods ensure clean state between test cases

This module enables comprehensive testing of process management code with full control over process lifecycle, communication, and error conditions without external dependencies.