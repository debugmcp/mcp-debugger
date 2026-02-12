# packages\adapter-mock/
@generated: 2026-02-12T21:01:17Z

## Purpose and Responsibility

The `adapter-mock` package provides a comprehensive mock debug adapter implementation for the MCP (Model Context Protocol) debugger system. This module serves as the primary testing infrastructure, enabling development and testing of debug scenarios without requiring actual debugger dependencies. It supports both programmatic library integration and standalone testing modes with full Debug Adapter Protocol (DAP) simulation.

## Key Components and Architecture

The package follows a layered architecture with three core implementation layers:

### Factory Layer
- **MockAdapterFactory**: Implements `IAdapterFactory` interface for creating mock adapter instances
- **Configuration Management**: Handles `MockAdapterConfig` with configurable behavior including timing delays, error scenarios, and feature toggles
- **Metadata Provider**: Supplies adapter metadata (language: MOCK, version: 1.0.0, supported extensions)

### Core Adapter Layer
- **MockDebugAdapter**: Main mock implementation extending EventEmitter and implementing `IDebugAdapter`
- **State Management**: Maintains permissive state transitions matching real adapter behavior
- **DAP Simulation**: Delegates protocol operations to ProxyManager with realistic event propagation

### Process Server Layer
- **MockDebugAdapterProcess**: Standalone DAP server supporting stdio/TCP communication
- **Protocol Handling**: Complete DAP message processing with 16 supported commands
- **Session Simulation**: Maintains debug state including breakpoints, variables, and execution context

## Public API Surface

### Primary Entry Points
- `MockAdapterFactory`: Factory class for creating mock adapters with dependency injection
- `MockDebugAdapter`: Core mock adapter implementation with full DAP support
- `MockErrorScenario`: Enumeration for error simulation testing scenarios
- `MockAdapterConfig`: Configuration interface for adapter behavior customization
- `createMockAdapterFactory()`: Convenience factory function for simplified setup

### Usage Patterns
```typescript
// Library integration mode
const factory = new MockAdapterFactory(config);
const adapter = factory.createAdapter(dependencies);

// Standalone testing mode
node mock-adapter-process.js --port 4711 --host localhost
```

## Internal Organization and Data Flow

1. **Factory Creation**: MockAdapterFactory validates configuration and manages adapter instance creation
2. **Adapter Initialization**: MockDebugAdapter applies configuration, transitions states, and emits lifecycle events
3. **DAP Protocol Simulation**: Operations flow through ProxyManager with configurable delays and error injection
4. **Event Propagation**: Lifecycle events (connected, disconnected, disposed) propagate through EventEmitter pattern
5. **State Management**: Permissive state transitions enable flexible testing scenarios

## Testing and Configuration Features

### Error Simulation Capabilities
- Configurable error scenarios (executable not found, crashes, timeouts, memory errors)
- Performance testing with CPU/memory intensive operation simulation
- Timing control with configurable delays for all operations

### Development Support
- Feature toggles for enabling/disabling specific adapter capabilities
- Validation control with configurable success/failure for edge case testing
- Comprehensive test coverage from integration through detailed unit testing

## Integration Points

### Dependencies
- **External**: `@vscode/debugprotocol` for DAP types, Node.js built-ins (events, net, stream)
- **Internal**: `@debugmcp/shared` for core interfaces (`IAdapterFactory`, `IDebugAdapter`)
- **Testing**: Vitest configuration with TypeScript support and monorepo workspace aliases

### Test Infrastructure
- Integration tests validate public API exposure and basic functionality
- Unit tests provide comprehensive coverage of factory patterns and adapter lifecycle
- Shared testing utilities enable consistent patterns across test files

This package serves as the foundation for testing the MCP debugger system, providing both programmatic and standalone capabilities with comprehensive DAP protocol simulation and configurable behavior for various testing scenarios.