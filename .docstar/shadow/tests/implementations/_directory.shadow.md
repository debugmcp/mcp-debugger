# tests/implementations/
@generated: 2026-02-10T01:19:52Z

## Overall Purpose and Responsibility

The `tests/implementations` directory provides a comprehensive test double ecosystem for process management functionality. It serves as the primary testing infrastructure for all process-related operations, offering controllable, deterministic mock implementations that eliminate the need to spawn real processes during testing. This enables reliable unit testing of complex process lifecycles, debugging workflows, and inter-process communication patterns.

## Key Components and How They Relate

The directory implements a complete parallel hierarchy to the production process system, organized in three architectural layers:

**Foundation Layer**
- `FakeProcess` - Core process simulation implementing the `IProcess` interface with full lifecycle control
- `FakeProcessLauncher` - Basic process factory for standard process creation scenarios

**Specialized Process Layer**
- `FakeDebugTargetLauncher` - Handles Python debugging scenarios with automatic debug port management
- `FakeProxyProcess` - Enhanced process mock with command interception and proxy-specific behaviors
- `FakeProxyProcessLauncher` - Specialized factory for proxy processes with built-in initialization handling

**Orchestration Layer**
- `FakeProcessLauncherFactory` - Centralized singleton factory providing unified access to all launcher types

The components work together through a factory pattern where the central factory manages instances of all specialized launchers, enabling coordinated testing across different process types while maintaining isolation and state consistency.

## Public API Surface

**Primary Entry Points:**
- `FakeProcessLauncherFactory` - Main access point for obtaining any launcher type in the system
- Individual launcher classes (`FakeProcessLauncher`, `FakeDebugTargetLauncher`, `FakeProxyProcessLauncher`) for direct instantiation in isolated tests

**Core Testing Interface:**
- `launch()` family of methods - Create mock processes with configurable behavior
- `simulate*()` methods - Control process events (output generation, error conditions, exit scenarios)
- `prepare*()` methods - Pre-configure upcoming process behavior for deterministic testing
- `reset()` methods - Clean slate initialization for test isolation

**Process Control API:**
- Standard process operations (`kill()`, `terminate()`) with controllable outcomes
- Stream-based I/O simulation using Node.js PassThrough streams
- Event-driven lifecycle simulation matching real process behavior patterns

## Internal Organization and Data Flow

**State Architecture:**
- Each fake maintains comprehensive launch history and process registries
- Process state managed through private fields mirroring real process properties
- Automatic resource allocation (PIDs, debug ports) with predictable defaults for test reproducibility

**Event Simulation Pipeline:**
- EventEmitter-based async behavior using `process.nextTick()` for realistic timing
- Stream-based I/O handling with controllable output and error generation
- Command interception and auto-response for common initialization patterns

**Cross-Component Coordination:**
- Centralized factory enables global state management and coordinated resets
- Shared conventions for deterministic behavior (fixed PIDs, sequential port allocation)
- Consistent async simulation patterns across all fake implementations

## Important Patterns and Conventions

**Comprehensive Test Double Strategy:** The implementation provides rich, controllable fakes rather than simple stubs, enabling complex scenario simulation while maintaining deterministic behavior essential for reliable testing.

**Centralized Factory Management:** The singleton factory pattern ensures consistent access to test doubles while enabling global state coordination and cleanup operations.

**Realistic Async Simulation:** All fakes maintain the async, event-driven nature of real processes through careful use of EventEmitter patterns and `process.nextTick()` timing, ensuring tests accurately reflect production behavior timing.

**Zero External Dependencies:** The entire test infrastructure operates without spawning actual processes or requiring external resources, making tests fast, reliable, and suitable for any environment.