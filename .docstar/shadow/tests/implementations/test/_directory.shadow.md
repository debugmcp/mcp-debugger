# tests\implementations\test/
@generated: 2026-02-12T21:05:44Z

## Overall Purpose and Responsibility

This directory provides a comprehensive test implementation layer for process management and launching functionality. It contains controllable test doubles (fake implementations) that simulate all process-related interfaces without spawning real processes, enabling deterministic unit testing of process lifecycle management, debugging workflows, and proxy communication patterns.

## Key Components and Relationships

The module implements a layered architecture of test doubles that mirror the production process management system:

**Core Process Layer**
- `FakeProcess` - Base process mock implementing `IProcess` with controllable lifecycle events
- `FakeProxyProcess` - Extended process mock for proxy scenarios with command tracking

**Process Launchers**
- `FakeProcessLauncher` - Basic process launcher for general process spawning
- `FakeDebugTargetLauncher` - Specialized launcher for Python debugging scenarios with port management
- `FakeProxyProcessLauncher` - Advanced launcher with automatic initialization handling

**Factory and Coordination**
- `FakeProcessLauncherFactory` - Centralized factory providing singleton access to all fake launchers
- Unified reset mechanism across all components for test isolation

## Public API Surface

**Primary Entry Point**
- `FakeProcessLauncherFactory` - Main factory class providing access to all launcher implementations

**Core Testing Methods**
- `launch()` / `launchPythonDebugTarget()` / `launchProxy()` - Process creation methods
- `simulate*()` methods - Control process lifecycle events (output, errors, exit, spawn)
- `prepare*()` methods - Pre-configure next process/target behavior
- `reset()` methods - Clean state for test isolation
- History tracking properties - Verify launched processes and sent commands

## Internal Organization and Data Flow

**Process Simulation Flow**
1. Factory creates appropriate launcher instance
2. Launcher creates fake process with deterministic properties (PID 12345)
3. Process provides controllable streams (PassThrough) for I/O simulation
4. Test code controls process behavior via simulate methods
5. Events are emitted asynchronously using `process.nextTick()` for realistic timing

**State Management**
- Each launcher tracks its launched processes/targets for verification
- Commands and interactions are logged for test assertions
- Auto-incrementing debug ports (starting at 5678) for debugging scenarios
- Automatic initialization responses in proxy scenarios

## Important Patterns and Conventions

**Test Double Patterns**
- EventEmitter-based simulation matching real Node.js process behavior
- Controllable deterministic behavior instead of real system dependencies
- Method interception for automatic response handling (proxy initialization)

**Testing Support Features**
- Comprehensive history tracking for all operations
- Pre-configuration capabilities for complex test scenarios  
- Unified reset mechanism for test isolation
- Async simulation using Node.js event loop for realistic timing

**Integration Points**
- Implements all production process interfaces for drop-in replacement
- Maintains API compatibility while providing test-specific enhancements
- Centralized factory pattern enables easy integration into test suites