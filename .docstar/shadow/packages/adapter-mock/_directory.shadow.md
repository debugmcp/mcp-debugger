# packages\adapter-mock/
@children-hash: e27a6fa936672b91
@generated: 2026-02-15T09:01:47Z

## Overall Purpose and Responsibility

The `adapter-mock` package provides a complete mock implementation of the Debug Adapter Protocol (DAP) for testing and development within the MCP (Model Context Protocol) debugger system. This module serves as both a testing utility and a reference implementation, enabling comprehensive validation of DAP clients without requiring external language runtimes or actual debuggers while maintaining full protocol compatibility.

## Key Components and Integration

### Core Architecture
The package follows a layered architecture with clear separation of concerns:

**Factory Layer** (`MockAdapterFactory`):
- Implements `IAdapterFactory` interface for seamless MCP system integration
- Provides metadata (language: MOCK, extensions: .mock/.test) and validation
- Creates configured `MockDebugAdapter` instances with custom behavior settings

**Adapter Layer** (`MockDebugAdapter`):
- Core DAP implementation extending EventEmitter and implementing `IDebugAdapter`
- Orchestrates debugging lifecycle with proper state machine transitions
- Manages communication with the underlying mock debug process
- Provides comprehensive DAP capabilities: breakpoints, stepping, variable inspection, stack traces

**Process Layer** (`MockDebugAdapterProcess`):
- Standalone DAP server that can operate via stdio or TCP
- Implements complete DAP message protocol with proper Content-Length headers
- Maintains realistic debug session state and handles actual DAP request/response cycles
- Provides the simulation engine that powers the adapter's debugging capabilities

### Component Relationships and Data Flow
1. **Initialization**: Factory creates adapter instances with optional configuration for error scenarios and timing
2. **Process Orchestration**: Adapter spawns and manages communication with the mock debug process
3. **Protocol Handling**: Process implements full DAP specification while adapter tracks state and emits events
4. **State Synchronization**: Complete lifecycle management from UNINITIALIZED through DEBUGGING to DISCONNECTED

## Public API Surface

### Primary Entry Points
- **`MockAdapterFactory`**: Main factory class for creating mock adapter instances
- **`MockDebugAdapter`**: Core adapter implementation with full DAP support
- **`MockErrorScenario`**: Enumeration for simulating various error conditions
- **`MockAdapterConfig`**: Configuration interface for customizing adapter behavior
- **`createMockAdapterFactory()`**: Convenience helper for factory creation

### Key Capabilities
- **Complete DAP Support**: Full initialization, execution control, breakpoint management, and variable inspection
- **Testing-Focused Features**: Configurable delays, error injection, and deterministic behavior
- **Flexible Communication**: Support for both stdio and TCP communication modes
- **Integration Ready**: Seamless integration with MCP adapter factory pattern

## Internal Organization and Patterns

### Development and Testing Infrastructure
- **Vitest Configuration**: Comprehensive test setup with TypeScript support and monorepo aliases
- **Test Coverage**: Complete unit and integration testing for all components
- **Mock Strategy**: Systematic dependency injection and isolation for reliable testing
- **Performance Validation**: Configuration warning system for development guidance

### Key Design Patterns
- **Factory Pattern**: Clean instantiation and configuration of adapter instances
- **Event-Driven Architecture**: Loose coupling between adapter and process layers
- **State Machine Management**: Proper DAP lifecycle state transitions
- **Dependency Injection**: Testable architecture with configurable behavior

This package enables developers to build and test DAP clients with confidence, providing a reliable simulation of real debugging scenarios while maintaining the flexibility needed for comprehensive testing workflows within the broader MCP debugger ecosystem.