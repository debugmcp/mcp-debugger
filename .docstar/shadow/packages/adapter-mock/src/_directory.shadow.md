# packages/adapter-mock/src/
@generated: 2026-02-10T01:19:36Z

## Overall Purpose and Responsibility

The `packages/adapter-mock/src` module provides a comprehensive mock debug adapter implementation for testing the MCP debugger system. It simulates a complete Debug Adapter Protocol (DAP) server without requiring external debugger dependencies, enabling isolated testing of debug client functionality, adapter lifecycle management, and protocol interactions.

## Key Components and Relationships

### Core Architecture
- **MockAdapterFactory**: Factory class implementing `IAdapterFactory` that creates `MockDebugAdapter` instances
- **MockDebugAdapter**: Main adapter implementation that simulates DAP operations with configurable behavior
- **MockDebugAdapterProcess**: Standalone executable DAP server for integration testing
- **Entry Module (index.ts)**: Barrel export providing unified public API

### Component Interactions
The factory creates adapter instances with injected dependencies and configuration. The adapter delegates DAP protocol operations to a proxy manager while maintaining state and emitting lifecycle events. The standalone process provides a complete DAP server that can run via stdio or TCP for external client testing.

## Public API Surface

### Main Entry Points
- **MockAdapterFactory**: Primary factory class for creating mock adapters
- **MockDebugAdapter**: Core adapter implementation class
- **MockErrorScenario**: Enumeration for simulating specific error conditions
- **MockAdapterConfig**: Configuration interface for customizing adapter behavior
- **createMockAdapterFactory()**: Convenience factory function

### Configuration Options
The mock adapter supports extensive configuration including:
- Operation timing delays for performance testing
- Error simulation with configurable scenarios and probabilities
- Feature support toggles for testing different capability combinations
- Performance simulation options (CPU/memory intensive operations)

## Internal Organization and Data Flow

### State Management
Adapters follow a permissive state transition model allowing flexible testing of various lifecycle scenarios. State changes emit events for monitoring and validation.

### Protocol Handling
DAP requests flow through the adapter's proxy manager, which delegates to appropriate handlers. The standalone process implements full DAP command handling with realistic mock data generation.

### Error Simulation
Configurable error scenarios allow testing of failure conditions including connection timeouts, adapter crashes, invalid breakpoints, and memory errors.

## Important Patterns and Conventions

### Factory Pattern
Uses factory pattern for adapter creation with dependency injection and configuration customization.

### Proxy Pattern
DAP operations delegate through proxy manager rather than direct implementation, enabling flexible behavior modification.

### Event-Driven Architecture
Adapters emit lifecycle events (initialized, connected, disconnected, disposed) for monitoring and testing.

### Transport Abstraction
Supports both stdio and TCP transport modes, enabling testing in various deployment scenarios.

### Mock Data Generation
Provides realistic debugging data including stack traces, variable scopes, and breakpoint verification for comprehensive protocol testing.

The module serves as a complete testing foundation for debug adapter development, providing both unit testing capabilities through the adapter classes and integration testing through the standalone process implementation.