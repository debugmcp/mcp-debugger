# packages\adapter-mock\src/
@generated: 2026-02-12T21:00:56Z

## Purpose
The `adapter-mock` source directory provides a comprehensive mock debug adapter implementation for testing and development of the MCP debugger system. This module enables testing of debug scenarios without requiring actual debugger dependencies, supporting both library integration and standalone testing modes.

## Architecture Overview

The module follows a layered architecture with three primary implementation layers:

1. **Factory Layer** (`mock-adapter-factory.ts`): Implements the `IAdapterFactory` interface to create mock adapter instances with configurable behavior
2. **Core Adapter** (`mock-debug-adapter.ts`): Main mock adapter implementation providing full DAP (Debug Adapter Protocol) simulation
3. **Process Server** (`mock-adapter-process.ts`): Standalone DAP server for integration testing via stdio/TCP communication

## Key Components and Integration

### MockDebugAdapter
- Core mock implementation extending EventEmitter and implementing `IDebugAdapter`
- Provides configurable behavior through `MockAdapterConfig` including timing delays, error scenarios, and feature support
- Maintains state management with permissive transitions matching real adapter behavior
- Delegates DAP operations to ProxyManager while emitting appropriate lifecycle events

### MockAdapterFactory  
- Factory implementation creating `MockDebugAdapter` instances with dependency injection
- Provides metadata (language: MOCK, version: 1.0.0, file extensions: .mock/.test)
- Includes validation logic with configurable warnings and error conditions
- Enables consistent adapter creation across testing scenarios

### MockDebugAdapterProcess
- Standalone DAP protocol server supporting both stdio and TCP communication modes
- Implements complete DAP message handling with 16 supported commands
- Maintains realistic debug session state including breakpoints, variables, and execution position
- Provides sample variable data and stack traces for comprehensive testing

## Public API Surface

**Primary Entry Points** (via `index.ts`):
- `MockAdapterFactory`: Factory class for creating mock adapters
- `MockDebugAdapter`: Core mock adapter implementation  
- `MockErrorScenario`: Enumeration for error simulation testing
- `MockAdapterConfig`: Configuration interface for adapter behavior
- `createMockAdapterFactory()`: Convenience factory function

**Usage Patterns**:
```typescript
// Library integration
const factory = new MockAdapterFactory(config);
const adapter = factory.createAdapter(dependencies);

// Standalone testing
node mock-adapter-process.js --port 4711 --host localhost
```

## Internal Data Flow

1. **Factory Creation**: `MockAdapterFactory` validates configuration and creates adapter instances
2. **Adapter Initialization**: `MockDebugAdapter` applies config, transitions states, emits events
3. **DAP Simulation**: Protocol operations delegate through ProxyManager with configurable delays/errors
4. **State Management**: Permissive state transitions allow flexible testing scenarios
5. **Event Propagation**: Lifecycle events (connected, disconnected, disposed) flow through EventEmitter

## Testing and Configuration Features

- **Error Simulation**: Configurable error scenarios (executable not found, crashes, timeouts, memory errors)
- **Performance Testing**: CPU/memory intensive operation simulation
- **Timing Control**: Configurable delays for all operations
- **Feature Toggles**: Enable/disable specific adapter capabilities
- **Validation Control**: Configurable validation success/failure for testing edge cases

## Dependencies

**External**:
- `@vscode/debugprotocol`: DAP type definitions and protocol structures
- `@debugmcp/shared`: Core interfaces (`IAdapterFactory`, `IDebugAdapter`, adapter types)
- Node.js built-ins: `events`, `net`, `path`, `stream`

**Internal**: Circular dependency resolution through barrel exports in `index.ts`

This module serves as the primary testing infrastructure for the MCP debugger system, providing both programmatic and standalone testing capabilities with comprehensive DAP protocol simulation.