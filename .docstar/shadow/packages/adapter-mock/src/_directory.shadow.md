# packages/adapter-mock/src/
@generated: 2026-02-09T18:16:10Z

## Purpose and Responsibility

The `packages/adapter-mock/src` directory implements a complete mock debug adapter system for testing the DebugMCP framework. It provides a fully functional debugging simulation environment that allows developers to test debug adapter integrations, protocol implementations, and VS Code debugging workflows without requiring actual runtime environments or external dependencies.

## Key Components and Architecture

### Core Components

**MockDebugAdapter** - The primary adapter implementation that simulates debugging behavior with configurable features, timing delays, and error scenarios. Implements the IDebugAdapter interface with full DAP (Debug Adapter Protocol) support and maintains debugging state through a permissive state machine.

**MockAdapterFactory** - Factory class implementing IAdapterFactory interface for creating mock adapter instances. Handles adapter creation, metadata provision, and validation simulation with configurable warnings based on adapter settings.

**MockDebugAdapterProcess** - Standalone DAP server implementation that can run as a separate process, providing complete protocol simulation including breakpoint management, execution control, variable inspection, and both stdio/TCP communication modes.

**DAPConnection** - Low-level protocol handler managing DAP wire protocol with Content-Length framing, message buffering, and JSON serialization for both process and network communication.

### Supporting Infrastructure

**MockAdapterConfig** - Configuration interface controlling all aspects of mock behavior including timing delays, feature support, error simulation probability, and performance flags.

**MockErrorScenario** - Enumeration of testable error conditions (connection timeouts, adapter crashes, executable not found, etc.) for comprehensive error handling testing.

## Public API Surface

The module exposes a clean public API through its index file:

- **MockDebugAdapter** - Main adapter implementation for direct integration
- **MockAdapterFactory** - Factory for creating adapter instances with dependency injection
- **MockAdapterConfig** - Type definition for adapter configuration
- **MockErrorScenario** - Error scenario enumeration for testing
- **createMockAdapterFactory()** - Convenience factory function

## Data Flow and Integration

1. **Creation Flow**: MockAdapterFactory creates MockDebugAdapter instances with injected dependencies and configuration
2. **Process Communication**: MockDebugAdapter launches MockDebugAdapterProcess as external process for DAP protocol simulation
3. **Protocol Handling**: DAPConnection manages low-level DAP messaging while MockDebugAdapterProcess handles command logic
4. **State Management**: MockDebugAdapter maintains debugging state and delegates DAP operations to ProxyManager for actual communication

## Key Patterns and Conventions

### Configuration-Driven Behavior
All mock behavior is controlled through MockAdapterConfig, enabling fine-tuned testing scenarios with customizable delays, error rates, and feature support.

### Permissive State Machine
Unlike strict state machines, the mock adapter allows flexible state transitions to match real-world adapter behavior patterns, making tests more realistic.

### Dual Communication Modes
Supports both stdio (process-based) and TCP (network-based) communication for testing different VS Code debugging integration patterns.

### Comprehensive DAP Simulation
Implements full DAP protocol including initialization sequences, breakpoint management, execution control, stack traces, variable inspection, and proper event/response handling.

### Realistic Testing Environment
Provides authentic debugging simulation with:
- Configurable timing delays for realistic response patterns
- Probability-based error injection for failure scenario testing
- Mock file system with .mock and .test extensions
- Simulated variable scopes and stack frames
- Proper DAP capability advertisement

## Internal Organization

The module follows a layered architecture:
- **Public API Layer**: Index file providing clean exports
- **Factory Layer**: MockAdapterFactory for instance creation and validation
- **Adapter Layer**: MockDebugAdapter for state management and protocol integration
- **Process Layer**: MockDebugAdapterProcess for standalone DAP server simulation
- **Protocol Layer**: DAPConnection for low-level message handling

This organization enables comprehensive testing of debug adapter functionality while maintaining clear separation of concerns and providing flexible configuration options for various testing scenarios.