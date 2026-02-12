# packages\adapter-mock/
@generated: 2026-02-12T21:06:12Z

## Mock Debug Adapter Package

**Overall Purpose:** This package provides a comprehensive mock debug adapter implementation for testing the MCP (Message Control Protocol) debugger system. It simulates a fully functional Debug Adapter Protocol (DAP) compliant debugger without requiring external dependencies or actual debugger processes, enabling thorough testing of debug clients and the broader debugging infrastructure.

## Key Components & Architecture

### Public API Surface
The package exports a clean, focused API through its barrel exports:
- **`MockAdapterFactory`**: Primary factory class implementing `IAdapterFactory` interface
- **`MockDebugAdapter`**: Core mock adapter implementation with full DAP compliance
- **`MockErrorScenario`**: Enumeration for simulating specific error conditions
- **`MockAdapterConfig`**: Configuration interface for customizing adapter behavior
- **`createMockAdapterFactory()`**: Convenience factory function for quick instantiation

### Core Implementation Layers

**Factory Layer (`MockAdapterFactory`)**:
- Implements standard adapter factory interface with metadata generation
- Provides adapter discovery information (language: MOCK, version: 1.0.0, extensions)
- Handles configuration validation with intelligent warnings for testing scenarios
- Creates properly configured mock adapter instances with dependency injection

**Mock Adapter Layer (`MockDebugAdapter`)**:
- Event-driven architecture extending EventEmitter with lifecycle events
- Comprehensive state management (INITIALIZING → READY → CONNECTED → DEBUGGING)
- Configurable behavior including timing delays, error simulation, and feature toggles
- Full DAP protocol compliance through proxy delegation patterns

**Standalone Process Layer (`MockDebugAdapterProcess`)**:
- Independent DAP server supporting both stdio and TCP communication
- Complete implementation of 16 core DAP commands
- Realistic debug state management including breakpoints and variables
- Enables integration testing scenarios requiring separate debugger processes

## Integration & Data Flow

1. **Factory Creation**: `MockAdapterFactory` instantiated with optional configuration
2. **Adapter Instantiation**: Factory creates configured `MockDebugAdapter` instances
3. **Protocol Handling**: Adapter delegates DAP operations through proxy management
4. **State Management**: Maintains debug session state with proper event emissions
5. **Testing Scenarios**: Configurable delays, errors, and behaviors enable comprehensive validation

## Testing Infrastructure

The package includes a comprehensive test suite validating:
- **Package Integration**: Export verification and factory instantiation
- **Factory Behavior**: Configuration handling, metadata generation, validation logic
- **Adapter Lifecycle**: State transitions, connection flows, event emissions
- **Error Scenarios**: Mock error handling using configurable scenarios
- **DAP Compliance**: Protocol adherence and message handling

**Testing Patterns**:
- Multi-layer validation from package-level to unit-level coverage
- Shared dependency injection helpers for consistent mock setup
- Event-driven testing with proper async lifecycle validation
- Error scenario simulation with realistic state management

## Configuration & Flexibility

The mock adapter supports extensive configuration for testing scenarios:
- **Timing Control**: Adjustable delays for operation simulation
- **Error Simulation**: Configurable error rates and specific scenario testing
- **Feature Control**: Enable/disable debugging features for targeted testing
- **Performance Modes**: CPU and memory intensive operation simulation
- **Communication Options**: Both embedded and standalone server deployment

## Key Patterns & Conventions

- **Factory Pattern**: Centralized creation and configuration management
- **Proxy Pattern**: DAP operation delegation for protocol abstraction
- **Event-Driven Architecture**: Lifecycle and state change notifications
- **Interface Compliance**: Strict adherence to debug adapter contracts
- **Configuration Strategy**: Extensive options for flexible testing scenarios
- **Mock Strategy**: Realistic behavior simulation without external dependencies

This package serves as the foundational testing infrastructure for the MCP debugger system, enabling comprehensive validation of debug clients, protocol implementations, and adapter integrations through a sophisticated, configurable mock implementation.