# tests\implementations/
@children-hash: cf7f9caef14ba447
@generated: 2026-02-15T09:01:40Z

## Overall Purpose and Responsibility

The `tests/implementations` directory provides a comprehensive suite of test doubles and fake implementations for the entire process management system. This module enables deterministic, isolated unit testing of process-launching functionality by replacing real process operations with controllable, predictable mock implementations. It serves as the foundation for testing all process management code without spawning actual external processes or requiring system dependencies.

## Key Components and Integration

The directory contains a hierarchical set of fake implementations that mirror the production process management architecture:

### Core Process Layer
- **FakeProcess** - Base process simulation with EventEmitter-based lifecycle events, controllable streams, and deterministic behavior (fixed PID 12345)

### Launcher Implementations  
- **FakeProcessLauncher** - Basic process launching with command/argument tracking and history
- **FakeDebugTargetLauncher** - Specialized Python debugging launcher with automatic port assignment (starting at 5678)
- **FakeProxyProcess** - Extended process mock with command interception and automatic response capabilities  
- **FakeProxyProcessLauncher** - Proxy-specific launcher with built-in initialization handling

### Coordination Layer
- **FakeProcessLauncherFactory** - Centralized factory providing singleton access to all fake launcher instances and coordinating the test environment

These components work together as a cohesive testing ecosystem, where the factory provides access to specialized launchers, which create controllable process instances that can be manipulated through simulation methods for comprehensive test coverage.

## Public API Surface

### Primary Entry Points
- `FakeProcessLauncherFactory` - Main factory for obtaining all fake launcher instances in the test environment
- `FakeProcessLauncher.launch()` - Creates controllable fake process instances with full lifecycle control
- `FakeDebugTargetLauncher.launchPythonDebugTarget()` - Specialized debug target creation with automatic port management
- `FakeProxyProcessLauncher.launchProxy()` - Proxy process creation with built-in initialization sequence handling

### Test Control Interface
- **Process Simulation**: `simulate*()` methods (simulateOutput, simulateError, simulateExit) for controlling process lifecycle events
- **Launch Preparation**: `prepare*()` methods for pre-configuring next launch behavior and responses
- **State Management**: `reset()` methods across all components for test isolation and clean state
- **Verification Support**: History tracking arrays and state inspection methods for asserting test expectations

## Internal Organization and Data Flow

The architecture follows a layered approach that mirrors production systems while providing full test control:

1. **Factory Layer** - Centralizes access to all fake implementations and manages singleton instances
2. **Launcher Layer** - Provides specialized launching capabilities for different process types (basic, debug, proxy)
3. **Process Layer** - Implements core process simulation with streams, events, and lifecycle management
4. **Control Layer** - Offers simulation methods and state tracking for test orchestration

Data flows from test code through launcher interfaces to fake process instances, with comprehensive bidirectional control over process communication, command interception, and event simulation.

## Important Testing Patterns

- **Deterministic Behavior** - Fixed identifiers (PIDs, ports) and predictable responses ensure test reliability
- **Async Event Simulation** - Uses `process.nextTick()` to properly simulate Node.js process event timing
- **Command Interception** - Automatic handling of common command patterns (e.g., proxy initialization)
- **Comprehensive Tracking** - Full history of launches, commands, and interactions for verification
- **Test Isolation** - Reset capabilities ensure clean state between test cases

This module enables complete testing of process management functionality with full control over process behavior, communication, and error conditions while eliminating external dependencies and ensuring test determinism.