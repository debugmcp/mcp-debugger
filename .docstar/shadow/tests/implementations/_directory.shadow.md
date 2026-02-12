# tests/implementations/
@generated: 2026-02-11T23:47:52Z

## Overall Purpose and Responsibility

The `tests/implementations` directory provides a comprehensive test infrastructure layer that enables deterministic unit testing of process management and debugging functionality without spawning real system processes. This module serves as the primary test double ecosystem, offering complete mock implementations of all process-related interfaces to support reliable, fast testing of complex process lifecycle scenarios.

## Key Components and How They Relate

The directory is organized around a **test double architecture** that mirrors the production process management system:

**Core Test Infrastructure (`test/`)**
- **Process Simulation Layer** - `FakeProcess` and `FakeProxyProcess` provide controllable process mocks with EventEmitter-based lifecycle simulation
- **Launcher Test Doubles** - `FakeProcessLauncher`, `FakeDebugTargetLauncher`, and `FakeProxyProcessLauncher` mock different process spawning scenarios
- **Factory Coordination** - `FakeProcessLauncherFactory` serves as the central orchestrator, providing singleton access to all launcher mocks

The components work together through a **factory pattern** where the central factory provides access to specialized launchers, each returning controllable process instances that can simulate real-world behavior deterministically.

## Public API Surface

**Primary Entry Point:**
- `FakeProcessLauncherFactory` - Central factory providing access to all test doubles
  - `getProcessLauncher()` - Basic process spawning mock
  - `getDebugTargetLauncher()` - Python debugging scenarios with auto-incrementing ports
  - `getProxyProcessLauncher()` - Proxy communication with automatic command handling
  - `reset()` - Global state cleanup for test isolation

**Process Control API:**
- Controllable process instances with simulation methods: `simulateOutput()`, `simulateExit()`, `simulateError()`
- Pre-configuration methods: `prepareProcess()`, `prepareTarget()` for deterministic test setup
- History tracking arrays: `launchedProcesses`, `sentCommands` for test verification

## Internal Organization and Data Flow

**State Management:**
- Deterministic process IDs and auto-incrementing debug ports ensure predictable behavior
- Internal state tracking with cleanup capabilities maintains test isolation
- History arrays capture all interactions for comprehensive verification

**Event Simulation:**
- Async event simulation using `process.nextTick()` matches real Node.js process timing
- PassThrough streams provide realistic stdin/stdout/stderr behavior
- Command interception with automatic responses supports complex communication scenarios

## Important Patterns and Conventions

- **Complete Interface Compliance** - All fakes implement production interfaces exactly, enabling seamless substitution
- **Deterministic Behavior** - Controllable timing and responses eliminate test flakiness
- **Test Isolation** - Reset methods and independent state management ensure clean test runs
- **Event-Driven Simulation** - EventEmitter pattern provides realistic asynchronous process behavior

This directory enables comprehensive testing of process management workflows by providing a controlled, deterministic environment that replaces real system processes with fully controllable test doubles, supporting reliable unit testing of complex process lifecycle and communication scenarios.