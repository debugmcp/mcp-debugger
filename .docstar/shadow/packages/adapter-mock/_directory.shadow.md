# packages/adapter-mock/
@generated: 2026-02-10T21:26:45Z

## Overall Purpose

The `packages/adapter-mock` directory provides a comprehensive mock debug adapter implementation for the MCP debugger system. This module serves as both a testing framework and a development tool, enabling comprehensive validation of debug client functionality without requiring external debugger dependencies or real debug targets. It implements the complete Debug Adapter Protocol (DAP) with configurable behavior, error simulation capabilities, and flexible timing controls.

## Key Components and Integration

### Core Architecture
The module is built around three primary components that work together:

1. **MockDebugAdapter**: The main adapter implementation that simulates all debugging operations with configurable behavior and state management
2. **MockAdapterFactory**: Factory implementation following the standard `IAdapterFactory` interface for creating mock adapter instances with dependency injection
3. **MockDebugAdapterProcess**: Standalone DAP server process supporting both stdio and TCP transports for integration testing scenarios

These components share a common **MockAdapterConfig** configuration system that controls behavior patterns, error scenarios, and timing characteristics across the entire mock system.

### Component Relationships
- The factory creates adapter instances using dependency injection, ensuring consistent configuration and behavior
- The adapter uses a proxy pattern to delegate DAP operations while maintaining mock-specific state and timing
- The process wrapper provides a complete standalone implementation for testing real-world integration scenarios
- All components emit lifecycle events and maintain DAP compliance for seamless integration with debug clients

## Public API Surface

### Main Entry Points
- `MockAdapterFactory`: Primary factory class implementing the standard adapter factory interface
- `MockDebugAdapter`: Core adapter implementation for direct instantiation and testing
- `MockErrorScenario`: Enumeration of configurable error conditions for negative testing
- `MockAdapterConfig`: Configuration interface for controlling mock behavior

### Factory Functions
- `createMockAdapterFactory(config?)`: Convenience function for quick factory creation with optional configuration

### Process Interface
- Executable mock adapter process with command-line support for `--port`, `--host`, and `--session` parameters

## Internal Organization and Data Flow

### Protocol Implementation
The module provides full DAP support including initialization, launch configuration, breakpoint management, stepping operations, variable inspection, and stack trace generation. All operations maintain realistic timing and data patterns while supporting configurable error injection and performance characteristics.

### State Management
The adapter follows a standard lifecycle: uninitialized → initialized → connected → debugging → disconnected → disposed. State transitions are permissive to enable flexible testing scenarios while maintaining protocol compliance.

### Configuration Flow
Configuration is injected at creation time and flows through all operations, controlling error probability, timing delays, supported features, and behavioral patterns. This enables comprehensive testing of both success and failure scenarios.

## Important Patterns and Conventions

### Design Patterns
- **Factory Pattern**: Standardized adapter creation with metadata and validation
- **Proxy Pattern**: DAP operations delegated while maintaining mock-specific behavior  
- **Strategy Pattern**: Configurable error scenarios and timing behavior
- **Event-Driven Architecture**: Lifecycle and protocol events for integration testing

### Testing Integration
The module includes a comprehensive test suite covering:
- Package export validation and factory integration
- Complete adapter lifecycle and DAP event handling
- Configuration validation with performance threshold warnings
- Error scenario simulation and boundary condition testing

### Key Conventions
- Mock language identifier: `DebugLanguage.MOCK`
- Supported file extensions: `.mock`, `.test`
- Variable reference numbering starts at 1000
- Transport flexibility for different testing scenarios (stdio/TCP)

This module serves as the foundation for testing debug adapter functionality throughout the MCP debugger system, providing both unit-testable components and integration-testable processes while maintaining full DAP protocol compliance and realistic debugging behavior simulation.