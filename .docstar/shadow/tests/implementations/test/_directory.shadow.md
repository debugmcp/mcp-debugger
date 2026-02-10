# tests/implementations/test/
@generated: 2026-02-09T18:16:08Z

## Purpose
Test implementations module providing comprehensive fake/mock versions of process-related interfaces for unit testing. Enables deterministic, controllable testing of process spawning, debug target launching, and proxy process management without spawning real system processes or external dependencies.

## Key Components and Architecture

### Core Process Simulation
- **FakeProcess**: Base fake process implementation extending EventEmitter to simulate real process behavior with controllable PID, streams (stdin/stdout/stderr), IPC messaging, and lifecycle events
- **Process Control**: Provides methods to simulate process output, errors, exit conditions, and kill signals with proper event emission timing

### Launcher Implementations
- **FakeProcessLauncher**: Mock implementation of IProcessLauncher for basic process spawning with launch tracking and pre-configuration capabilities
- **FakeDebugTargetLauncher**: Specialized launcher for Python debug targets with auto-incrementing port management and debug session tracking
- **FakeProxyProcessLauncher**: Advanced launcher for proxy processes with automatic command response handling and session management

### Specialized Process Types
- **FakeProxyProcess**: Extended fake process implementing IProxyProcess interface with command tracking, JSON message handling, and initialization simulation
- **Session Management**: Built-in support for session-based operations and command/response patterns

### Factory Pattern
- **FakeProcessLauncherFactory**: Centralized factory providing singleton instances of all fake launchers with unified reset capabilities

## Public API Surface

### Main Entry Points
- `FakeProcessLauncherFactory`: Primary entry point providing access to all launcher implementations
- Factory methods: `createProcessLauncher()`, `createDebugTargetLauncher()`, `createProxyProcessLauncher()`
- Unified reset: `reset()` method clears state across all components

### Test Control Interface
- **Pre-configuration**: `prepare*()` methods allow setting up specific behavior before launch operations
- **State inspection**: `launched*` arrays and `getLast*()` methods enable test assertions
- **Simulation helpers**: Methods to trigger specific process events, outputs, and state changes

## Internal Organization and Data Flow

### State Tracking
- All launchers maintain arrays of launched processes/targets/proxies for test verification
- Comprehensive logging of commands, arguments, options, and session details
- Singleton pattern ensures state persistence across test operations

### Event Simulation
- Uses `process.nextTick()` to maintain proper event loop semantics
- Automatic emission of 'exit' and 'close' events for realistic process lifecycle simulation
- Built-in IPC message handling with proper async timing

### Auto-response Logic
- Proxy processes automatically respond to 'init' commands unless pre-configured
- Port auto-increment for debug targets to avoid conflicts
- Default successful initialization behavior with override capabilities

## Important Patterns and Conventions

### Test Double Pattern
- All implementations are true fakes (not stubs or mocks) providing working behavior
- Maintain interface compatibility with production implementations
- Enable both positive and negative test scenarios

### Builder Pattern
- `prepare*()` methods allow configuring specific instances before they're launched
- Chainable configuration for complex test scenarios
- Clear separation between preparation and execution phases

### Event-Driven Architecture
- Proper EventEmitter inheritance with realistic timing
- Consistent event emission patterns matching real process behavior
- Support for both synchronous state queries and asynchronous event handling

## Critical Design Decisions
- Singleton factory instances enable cross-test state inspection and coordination
- PassThrough streams provide realistic I/O behavior without external dependencies
- Auto-increment patterns (ports, PIDs) prevent test interference
- Comprehensive reset capabilities ensure test isolation when needed