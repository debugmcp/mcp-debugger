# packages\adapter-mock\src/
@generated: 2026-02-12T21:05:43Z

## Overall Purpose
This directory implements a comprehensive mock debug adapter package for testing the MCP debugger system. It provides a fully functional Debug Adapter Protocol (DAP) implementation that simulates real debugging scenarios without requiring external dependencies or actual debugger processes. The mock adapter supports configurable behavior, error simulation, and timing delays to enable thorough testing of debug adapter clients and the broader MCP debugging infrastructure.

## Key Components and Architecture

### Public API Layer (index.ts)
Serves as the clean entry point following a barrel export pattern:
- **MockAdapterFactory**: Primary factory for creating mock adapter instances
- **MockDebugAdapter**: Core mock adapter implementation
- **MockErrorScenario**: Enumeration for error condition simulation
- **MockAdapterConfig**: Configuration interface for adapter behavior

### Factory Layer (mock-adapter-factory.ts)
Implements the `IAdapterFactory` interface with:
- **MockAdapterFactory**: Creates and configures mock adapter instances
- **createMockAdapterFactory()**: Convenience factory function
- Provides adapter metadata (language: MOCK, version: 1.0.0, file extensions)
- Performs configuration validation with warnings for high error rates and delays

### Core Mock Implementation (mock-debug-adapter.ts)
The heart of the mock system:
- **MockDebugAdapter**: Full DAP-compliant adapter implementation extending EventEmitter
- **MockAdapterConfig**: Comprehensive configuration for timing, features, and error simulation
- **MockErrorScenario**: Specific error conditions for testing edge cases
- State management with permissive transitions matching real adapter behavior
- Event-driven architecture emitting lifecycle events (initialized, connected, disposed)

### DAP Server Process (mock-adapter-process.ts)
Standalone mock DAP server for integration testing:
- **DAPConnection**: Handles DAP protocol communication via stdin/stdout or TCP
- **MockDebugAdapterProcess**: Complete DAP server with 16 supported commands
- Maintains realistic debug state including breakpoints, variables, and execution position
- Supports both stdio and TCP communication modes for flexible testing scenarios

## Data Flow and Integration

1. **Factory Creation**: `MockAdapterFactory` is created with optional configuration
2. **Adapter Instantiation**: Factory creates `MockDebugAdapter` instances with dependencies
3. **DAP Communication**: Adapter handles DAP requests through proxy delegation or direct server process
4. **State Management**: Adapter maintains debug session state with event emissions
5. **Testing Scenarios**: Configurable delays, errors, and behaviors enable comprehensive testing

## Key Patterns and Conventions

- **Factory Pattern**: Centralizes adapter creation and configuration
- **Proxy Pattern**: DAP operations delegate to ProxyManager for protocol handling
- **Configuration Strategy**: Extensive configuration options for testing flexibility
- **Event-driven Architecture**: All components emit lifecycle and state change events
- **Interface Compliance**: Strict adherence to `IAdapterFactory` and `IDebugAdapter` contracts
- **Mock Strategy**: Simulates real debugging behavior without external dependencies

## Testing Capabilities

The mock adapter provides sophisticated testing features:
- **Error Simulation**: Configurable error scenarios and probability rates
- **Timing Control**: Adjustable delays for operation testing
- **Feature Toggle**: Enable/disable specific debug features for testing
- **Performance Simulation**: CPU and memory intensive operation modes
- **Protocol Testing**: Full DAP compliance with realistic message handling
- **Connection Testing**: Both embedded and standalone server modes

This mock adapter package serves as a crucial testing foundation for the MCP debugger system, enabling comprehensive validation of debug clients and protocol implementations without requiring actual debugger processes or external tool dependencies.