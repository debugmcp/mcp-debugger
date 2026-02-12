# tests\implementations/
@generated: 2026-02-12T21:05:57Z

## Overall Purpose and Responsibility

The `tests/implementations` directory provides a comprehensive test implementation layer that serves as a complete test double ecosystem for process management and launching functionality. This module enables deterministic unit testing of complex process lifecycle scenarios, debugging workflows, and proxy communication patterns without spawning real system processes or external dependencies.

## Key Components and How They Relate

The directory implements a layered architecture of controllable test doubles that mirror the production process management system:

**Process Simulation Layer**
- `FakeProcess` and `FakeProxyProcess` provide controllable process mocks implementing core `IProcess` interfaces
- EventEmitter-based simulation with deterministic properties (consistent PID 12345)
- PassThrough streams for controllable I/O simulation

**Launcher Implementation Layer**  
- `FakeProcessLauncher` - General process spawning with lifecycle control
- `FakeDebugTargetLauncher` - Python debugging scenarios with auto-incrementing port management
- `FakeProxyProcessLauncher` - Advanced proxy scenarios with automatic initialization handling

**Coordination and Factory Layer**
- `FakeProcessLauncherFactory` centralizes access to all fake launcher implementations
- Provides singleton pattern with unified reset mechanism for test isolation
- Maintains history tracking across all components for comprehensive test verification

## Public API Surface

**Primary Entry Point**
- `FakeProcessLauncherFactory` - Main factory class providing centralized access to all test launcher implementations

**Core Testing Interface**
- `launch()`, `launchPythonDebugTarget()`, `launchProxy()` - Process creation methods matching production APIs
- `simulate*()` methods - Programmatic control of process lifecycle events (output, errors, exit, spawn)
- `prepare*()` methods - Pre-configuration for complex test scenarios
- `reset()` methods - State cleanup for test isolation

**Verification and Inspection**
- History tracking properties for verifying launched processes and sent commands
- Comprehensive logging of all interactions for test assertions

## Internal Organization and Data Flow

The module follows a controlled simulation pattern where:

1. **Factory Creation** - `FakeProcessLauncherFactory` provides appropriate launcher instances
2. **Process Instantiation** - Launchers create fake processes with controllable, deterministic behavior
3. **Event Simulation** - Process lifecycle events are triggered programmatically using `process.nextTick()` for realistic async timing
4. **State Tracking** - All operations are logged and made available for test verification
5. **Cleanup and Reset** - Unified reset mechanism ensures test isolation

## Important Patterns and Conventions

**Test Double Architecture**
- Complete API compatibility with production interfaces while providing test-specific enhancements
- Controllable deterministic behavior replacing real system dependencies
- Automatic response handling for complex scenarios (proxy initialization)

**Testing Support Features**
- Comprehensive history tracking for all launcher operations and process interactions
- Pre-configuration capabilities enabling complex multi-step test scenarios
- Realistic async simulation using Node.js event loop timing
- Centralized state management with unified cleanup mechanisms

This directory serves as the foundation for reliable, deterministic testing of process management functionality, providing complete control over process behavior while maintaining production API compatibility.