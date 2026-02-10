# tests/implementations/
@generated: 2026-02-09T18:16:36Z

## Purpose
Comprehensive test implementations module providing fake/mock versions of all process-related interfaces for deterministic unit testing. Enables complete isolation from real system processes, external dependencies, and I/O operations while maintaining interface compatibility and realistic behavior patterns.

## Key Components and Architecture

### Test Double Ecosystem
The directory provides a complete suite of fake implementations organized around process lifecycle management:

- **FakeProcess**: Core process simulation with controllable PID, streams, IPC messaging, and lifecycle events
- **FakeProcessLauncher**: Basic process spawning with launch tracking capabilities  
- **FakeDebugTargetLauncher**: Specialized Python debug target launcher with port management
- **FakeProxyProcessLauncher**: Advanced proxy process launcher with command/response handling
- **FakeProxyProcess**: Extended process implementing proxy-specific interfaces and session management
- **FakeProcessLauncherFactory**: Centralized factory providing singleton access to all implementations

### Unified Architecture
All components follow consistent patterns:
- EventEmitter-based for realistic async behavior
- Comprehensive state tracking for test assertions
- Pre-configuration capabilities for scenario setup
- Automatic response handling with override support

## Public API Surface

### Primary Entry Point
**FakeProcessLauncherFactory** serves as the main entry point with:
- `createProcessLauncher()`: Basic process spawning interface
- `createDebugTargetLauncher()`: Python debug session management  
- `createProxyProcessLauncher()`: Proxy process with command handling
- `reset()`: Unified state clearing across all components

### Test Control Interface
- **Pre-configuration**: `prepare*()` methods for setting up specific behaviors before launch
- **State Inspection**: `launched*` arrays and `getLast*()` methods for test assertions
- **Event Simulation**: Methods to trigger process events, outputs, and state changes
- **Lifecycle Control**: Process termination, signal handling, and exit code management

## Internal Organization and Data Flow

### State Management
- Singleton pattern ensures state persistence across test operations
- Comprehensive tracking of all launched processes, commands, and session details
- Auto-increment patterns (PIDs, ports) prevent test interference

### Event Flow
- Uses `process.nextTick()` for proper event loop timing
- Automatic 'exit' and 'close' event emission for realistic lifecycle simulation
- Built-in IPC message handling with async response patterns

### Command Processing
- Proxy processes automatically handle 'init' commands unless overridden
- JSON message parsing and response generation
- Session-based operation support with initialization tracking

## Important Patterns and Conventions

### True Fake Pattern
All implementations are working fakes (not stubs or mocks) that:
- Provide actual functionality rather than just recording calls
- Maintain full interface compatibility with production code
- Enable both positive and negative test scenarios
- Support complex interaction patterns and state transitions

### Factory Pattern
- Single factory instance coordinates all launcher types
- Unified reset capability for test isolation
- Consistent creation patterns across different process types
- Centralized configuration and state management

### Builder Configuration
- `prepare*()` methods enable pre-configuring specific instances
- Clear separation between preparation and execution phases
- Chainable configuration for complex test scenarios
- Override capabilities for edge case testing

## Testing Philosophy
This module embodies a comprehensive approach to process testing, providing deterministic, controllable alternatives to real system processes while maintaining the complexity and interaction patterns of production code. The unified factory pattern and consistent interfaces enable sophisticated testing scenarios without external dependencies or unpredictable system behavior.