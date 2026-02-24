# packages\adapter-mock/
@children-hash: 22074c2c4c0de408
@generated: 2026-02-24T01:54:49Z

## Purpose and Architecture

The `adapter-mock` package provides a complete mock implementation of the Debug Adapter Protocol (DAP) for testing and development within the MCP (Model Context Protocol) debugger ecosystem. This module enables comprehensive testing of debug adapter functionality without requiring external language runtimes or actual debuggers, while maintaining full DAP specification compliance.

## Core Components and Integration

### Public API Surface
The module exports four key components through a clean barrel export pattern:

- **MockAdapterFactory**: Primary integration point implementing `IAdapterFactory` interface for seamless integration with the MCP adapter system
- **MockDebugAdapter**: Core adapter implementation with full DAP support and configurable testing behavior  
- **MockDebugAdapterProcess**: Standalone DAP server process for realistic protocol simulation
- **MockErrorScenario**: Enumeration for systematic error condition testing
- **MockAdapterConfig**: Configuration interface for customizing mock behavior

### Component Relationships and Data Flow

1. **Factory Layer**: `MockAdapterFactory` serves as the entry point, creating configured `MockDebugAdapter` instances with metadata (language: MOCK, extensions: .mock/.test)

2. **Adapter Orchestration**: `MockDebugAdapter` manages the complete debugging lifecycle through state transitions (UNINITIALIZED → READY → CONNECTED → DEBUGGING), orchestrating communication with the underlying process

3. **Protocol Implementation**: `MockDebugAdapterProcess` provides the actual DAP server functionality, handling protocol messages, maintaining debug state, and simulating realistic debugging scenarios

4. **Configuration Layer**: Supports behavior customization including timing simulation, error injection, and feature toggling for comprehensive test coverage

## Key Features and Capabilities

### Comprehensive DAP Support
- Full initialization handshake and lifecycle management
- Execution control (continue, step, pause, terminate)
- Breakpoint management with file/line mapping
- Variable inspection with nested scope handling
- Stack trace generation with realistic frame data

### Testing-Focused Design
- Configurable delays and timing simulation for performance testing
- Systematic error scenario injection via `MockErrorScenario` enum
- Deterministic behavior with controllable state transitions
- No external runtime dependencies for isolated testing environments

### Flexible Communication Modes
- Stdio mode for direct process communication
- TCP mode for remote debugging simulation
- Event-driven architecture enabling loose coupling

## Internal Organization

The package follows clean separation of concerns:
- **Build Configuration**: TypeScript compilation with project references, ES module output, and incremental builds
- **Testing Infrastructure**: Vitest-based test suite with comprehensive unit and integration coverage
- **Source Structure**: Modular design with clear factory pattern implementation
- **Protocol Handling**: Complete DAP message protocol with Content-Length headers and proper state management

## Development and Testing Support

The module includes extensive testing coverage through:
- Integration tests validating package exports and basic functionality
- Comprehensive unit tests for factory patterns, adapter lifecycle, and error handling
- Mock dependency injection for reliable test execution
- State-driven testing ensuring proper DAP protocol compliance

This mock adapter serves as both a development tool for testing DAP clients and a reference implementation for understanding the complete debugging workflow within the MCP debugger system, enabling reliable testing scenarios without external dependencies.