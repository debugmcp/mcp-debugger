# packages/adapter-mock/
@generated: 2026-02-10T01:20:01Z

## Overall Purpose and Responsibility

The `adapter-mock` package provides a comprehensive mock debug adapter implementation designed for testing the MCP debugger system. This package enables isolated testing of debug client functionality, adapter lifecycle management, and Debug Adapter Protocol (DAP) interactions without requiring external debugger dependencies. It serves as both a testing utility for the broader MCP system and a reference implementation demonstrating proper adapter architecture patterns.

## Key Components and Relationships

### Core Architecture
- **MockAdapterFactory**: Primary factory class implementing `IAdapterFactory` that creates configured mock adapter instances
- **MockDebugAdapter**: Main adapter implementation that simulates complete DAP operations with configurable behavior and realistic debugging scenarios
- **MockDebugAdapterProcess**: Standalone executable DAP server enabling integration testing with external clients
- **MockErrorScenario**: Enumeration system for simulating specific failure conditions and edge cases
- **MockAdapterConfig**: Configuration interface providing extensive customization of adapter behavior

### Component Interaction Flow
The factory creates adapter instances with injected dependencies and user-defined configuration. Adapters delegate DAP protocol operations through a proxy manager while maintaining proper state transitions and emitting lifecycle events. The standalone process provides a complete DAP server that supports both stdio and TCP transport modes for comprehensive testing scenarios.

## Public API Surface

### Main Entry Points
- **`MockAdapterFactory`**: Core factory class for creating and configuring mock adapters
- **`MockDebugAdapter`**: Primary adapter implementation with full DAP simulation
- **`createMockAdapterFactory()`**: Convenience function for simplified factory instantiation
- **`MockErrorScenario`**: Error simulation configuration enumeration
- **`MockAdapterConfig`**: Configuration interface for behavior customization

### Key Capabilities
- **Configurable Behavior**: Operation timing delays, error probability simulation, feature support toggles
- **Comprehensive DAP Support**: Full protocol implementation with realistic mock data generation
- **Error Simulation**: Configurable failure scenarios including timeouts, crashes, and invalid operations
- **Transport Flexibility**: Support for stdio and TCP communication modes
- **Event-Driven Architecture**: Lifecycle event emission for monitoring and validation

## Internal Organization and Data Flow

### State Management
Adapters follow a permissive state transition model (INITIALIZING → READY → CONNECTED → DEBUGGING → DISCONNECTED) that allows flexible testing of various lifecycle scenarios. State changes emit proper events for external monitoring and validation.

### Protocol Implementation
DAP requests flow through the adapter's proxy manager, which delegates to appropriate handlers with realistic response generation. The system provides comprehensive mock data including stack traces, variable scopes, breakpoint verification, and debugging session management.

### Configuration System
Extensive configuration options enable testing of different adapter capabilities, performance characteristics, and error conditions. This includes feature support matrices, timing simulation, and failure mode injection.

## Important Patterns and Conventions

### Factory Pattern with Dependency Injection
The package uses the factory pattern for adapter creation, enabling clean dependency injection and configuration customization while maintaining proper interface compliance.

### Transport Abstraction
Support for multiple transport modes (stdio/TCP) enables testing in various deployment scenarios, from unit tests to full integration testing with external debug clients.

### Comprehensive Test Coverage
The package includes thorough test suites covering both package exports and internal implementation details, with shared test infrastructure for consistent dependency mocking and validation patterns.

### Event-Driven Lifecycle
Adapters emit standardized lifecycle events (initialized, connected, disconnected, disposed) enabling proper integration with debugging frameworks and monitoring systems.

This package serves as the foundation for testing debug adapter functionality within the MCP ecosystem, providing both programmatic testing capabilities and standalone server functionality for comprehensive validation of debug client implementations.