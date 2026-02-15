# packages\adapter-mock\src/
@children-hash: faccae5ecc2a8d6c
@generated: 2026-02-15T09:01:24Z

## Purpose
The `adapter-mock` source directory provides a complete mock implementation of the Debug Adapter Protocol (DAP) for testing and development purposes. This module enables comprehensive testing of the MCP debugger system without requiring external language runtimes or actual debuggers, while maintaining full compatibility with the DAP specification.

## Core Components and Architecture

### Public API Structure
The module follows a clean barrel export pattern through `index.ts`, providing these key entry points:
- **MockAdapterFactory**: Factory class implementing `IAdapterFactory` for creating mock adapter instances
- **MockDebugAdapter**: Core adapter implementation with full DAP support and configurable behavior
- **MockErrorScenario**: Enumeration for simulating various error conditions during testing
- **MockAdapterConfig**: Configuration interface for customizing mock adapter behavior

### Component Relationships

**MockAdapterFactory** (`mock-adapter-factory.ts`):
- Implements the standard `IAdapterFactory` interface for seamless integration
- Creates and configures `MockDebugAdapter` instances with custom settings
- Provides metadata (language: MOCK, extensions: .mock/.test) and validation capabilities
- Serves as the primary integration point with the larger MCP system

**MockDebugAdapter** (`mock-debug-adapter.ts`):
- Core implementation extending EventEmitter and implementing `IDebugAdapter`
- Manages complete debugging lifecycle with state machine (UNINITIALIZED → READY → CONNECTED → DEBUGGING)
- Provides comprehensive DAP capabilities: breakpoints, stepping, variable inspection, stack traces
- Supports error injection and timing simulation for robust testing scenarios

**MockDebugAdapterProcess** (`mock-adapter-process.ts`):
- Standalone DAP server process that can run via stdio or TCP
- Implements full DAP message protocol with Content-Length headers
- Maintains realistic debug session state with breakpoints, variables, and execution tracking
- Provides the actual debugging simulation that MockDebugAdapter orchestrates

### Data Flow and Integration

1. **Factory Creation**: `MockAdapterFactory` instantiated with optional configuration
2. **Adapter Creation**: Factory creates `MockDebugAdapter` instances with dependencies
3. **Process Orchestration**: Adapter spawns and communicates with `MockDebugAdapterProcess`
4. **Protocol Handling**: Process implements full DAP request/response cycle
5. **State Synchronization**: Adapter tracks process state and emits appropriate events

### Key Features

**Comprehensive DAP Support**:
- Full initialization handshake (initialize, launch, configurationDone)
- Execution control (continue, step, pause, terminate)
- Breakpoint management with file/line mapping
- Variable inspection with nested scope handling
- Stack trace generation with realistic frame data

**Testing-Focused Design**:
- Configurable delays and timing simulation
- Error scenario injection for robust test coverage
- Deterministic behavior with controllable state transitions
- No external runtime dependencies for isolated testing

**Flexible Communication**:
- Stdio mode for direct process communication
- TCP mode for remote debugging simulation
- Event-driven architecture for loose coupling

## Internal Organization

The module maintains clear separation of concerns:
- **Factory layer**: Integration with MCP adapter system
- **Adapter layer**: DAP protocol orchestration and state management  
- **Process layer**: Actual DAP message handling and debugging simulation
- **Configuration layer**: Behavior customization and error injection

This architecture enables the mock adapter to serve as both a development tool for testing DAP clients and a reference implementation for understanding the full debugging workflow in the MCP system.