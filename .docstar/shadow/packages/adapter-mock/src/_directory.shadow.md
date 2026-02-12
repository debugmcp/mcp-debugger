# packages/adapter-mock/src/
@generated: 2026-02-11T23:47:37Z

## Purpose
This directory implements a complete mock debug adapter system for testing the MCP (Message Control Protocol) debugger infrastructure without external dependencies. It provides a fully functional debug adapter that simulates DAP (Debug Adapter Protocol) operations with configurable behavior, error scenarios, and timing characteristics.

## Architecture Overview
The module follows a layered architecture with clear separation of concerns:

1. **Factory Layer**: `MockAdapterFactory` creates and configures mock adapter instances
2. **Adapter Layer**: `MockDebugAdapter` implements the core IDebugAdapter interface 
3. **Process Layer**: `MockDebugAdapterProcess` provides a standalone DAP server implementation
4. **Public API**: `index.ts` exposes a clean barrel export interface

## Key Components and Relationships

### MockAdapterFactory
- Implements `IAdapterFactory` interface for dependency injection compatibility
- Creates `MockDebugAdapter` instances with customizable configuration
- Provides metadata and validation for the mock debug language
- Serves as the primary entry point for framework integration

### MockDebugAdapter
- Core adapter implementation extending EventEmitter
- Manages debug session state with configurable error simulation
- Handles DAP protocol operations through proxy delegation
- Supports extensive configuration for testing various scenarios (timing, errors, feature support)

### MockDebugAdapterProcess
- Standalone DAP server for integration testing
- Supports both stdio and TCP communication modes
- Implements complete DAP protocol with 16+ command handlers
- Maintains realistic debugging state (breakpoints, variables, stack traces)

## Public API Surface

**Primary Exports** (from index.ts):
- `MockAdapterFactory` - Factory for creating mock adapters
- `MockDebugAdapter` - Core mock adapter implementation  
- `MockErrorScenario` - Enum for error simulation scenarios
- `MockAdapterConfig` - Configuration interface for adapter behavior

**Factory Function**:
- `createMockAdapterFactory(config?)` - Convenience constructor

## Internal Organization and Data Flow

1. **Configuration Flow**: MockAdapterConfig flows from factory through adapter to control all behavior
2. **State Management**: Adapter maintains state transitions following VALID_TRANSITIONS rules
3. **Event Flow**: EventEmitter pattern propagates adapter lifecycle events (connected, disconnected, disposed)
4. **Protocol Handling**: DAP messages flow through connection layer to request handlers with simulated responses

## Testing Capabilities

The module provides comprehensive testing support through:
- **Error Simulation**: Configurable error scenarios (crashes, timeouts, invalid states)
- **Timing Control**: Adjustable delays for operation simulation
- **Feature Toggling**: Enable/disable specific debug capabilities
- **Performance Simulation**: CPU/memory intensive operation modes
- **Validation Testing**: Configurable validation failures

## Integration Patterns

- **Dependency Injection**: Factory pattern enables clean integration with debug framework
- **Interface Compliance**: Strict adherence to IDebugAdapter and IAdapterFactory contracts
- **Event-Driven Communication**: Standard EventEmitter pattern for lifecycle management
- **Protocol Abstraction**: DAP implementation hidden behind adapter interface

This mock adapter system enables comprehensive testing of debug clients, protocol implementations, and integration scenarios without requiring real debugger installations or target programs.