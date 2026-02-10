# packages/adapter-mock/src/
@generated: 2026-02-10T21:26:20Z

## Overall Purpose
The `packages/adapter-mock/src` directory provides a complete mock debug adapter implementation for testing the MCP debugger system. This module enables comprehensive testing of debug client functionality without requiring external debugger dependencies or real debug targets. It implements the full Debug Adapter Protocol (DAP) with configurable behavior, error simulation, and timing controls.

## Key Components and Architecture

### Core Components
- **MockDebugAdapter**: Main adapter implementation that simulates debugging operations with configurable behavior
- **MockAdapterFactory**: Factory for creating mock adapter instances, implementing the standard `IAdapterFactory` interface
- **MockDebugAdapterProcess**: Standalone DAP server process that can run via stdio or TCP for integration testing
- **MockAdapterConfig**: Configuration system for controlling mock behavior, error scenarios, and timing
- **MockErrorScenario**: Enumeration of testable error conditions

### Component Relationships
The components form a layered architecture:
1. **MockAdapterFactory** creates **MockDebugAdapter** instances using dependency injection
2. **MockDebugAdapter** uses a proxy pattern to delegate DAP operations while maintaining state and configuration
3. **MockDebugAdapterProcess** provides a standalone implementation for process-based debugging scenarios
4. All components share **MockAdapterConfig** for consistent behavior configuration

## Public API Surface

### Main Entry Points (via index.ts)
- `MockAdapterFactory`: Primary factory class for creating adapters
- `MockDebugAdapter`: Core adapter implementation for direct instantiation
- `MockErrorScenario`: Error scenario enumeration for testing
- `MockAdapterConfig`: Configuration type definitions

### Factory Functions
- `createMockAdapterFactory(config?)`: Convenience function for factory creation

### Process Interface
- Executable mock adapter process supporting `--port`, `--host`, `--session` command-line arguments

## Internal Organization and Data Flow

### State Management
- Adapter lifecycle follows standard states (uninitialized → initialized → connected → disconnected → disposed)
- Permissive state transitions allow flexible testing scenarios
- Breakpoint and variable data maintained in-memory with realistic mock data

### Protocol Handling
- Full DAP command support including initialize, launch, breakpoints, stepping, variables, and stack traces
- Message parsing with Content-Length header processing
- Event emission for state changes and debugging events

### Configuration Flow
1. Configuration injected at factory or adapter creation
2. Default values applied for unspecified options
3. Runtime behavior controlled by configuration parameters
4. Error scenarios and timing delays applied consistently across operations

## Important Patterns and Conventions

### Design Patterns
- **Factory Pattern**: Standardized adapter creation with metadata and validation
- **Proxy Pattern**: DAP operations delegated while maintaining mock-specific behavior
- **Strategy Pattern**: Configurable error scenarios and timing behavior
- **Event-Driven**: Lifecycle events emitted for state changes

### Testing Conventions
- Comprehensive error simulation capabilities for negative testing
- Configurable timing delays for performance and timeout testing
- Realistic mock data (stack traces, variables, breakpoints) for functional testing
- Transport flexibility (stdio/TCP) for different testing scenarios

### Key Constraints
- Language reported as `DebugLanguage.MOCK` for identification
- Mock file extensions: `.mock`, `.test`
- Variable references start at 1000 for uniqueness
- Process cleanup on disconnect (stdio) vs. reconnection support (TCP)

This module serves as a complete testing framework for debug adapter functionality, providing both unit-testable components and integration-testable processes while maintaining full DAP compliance.