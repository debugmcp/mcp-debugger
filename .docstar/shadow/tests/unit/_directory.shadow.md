# tests\unit/
@children-hash: 4608ec382c95184f
@generated: 2026-02-19T23:48:21Z

## Overall Purpose
The `tests/unit` directory provides comprehensive unit test coverage for the Debug MCP Server, a debugging infrastructure that bridges the Model Context Protocol with various language debug adapters. This test suite validates all core components from CLI interfaces and container configuration through debug session management, DAP protocol handling, and multi-language adapter support.

## Architecture & Component Integration

The test suite is organized around the system's layered architecture:

### Foundation Layer
- **Utils**: Core utilities for path resolution, file operations, error handling, and container-aware configurations
- **Implementations**: Concrete classes for environment management, file system operations, network management, and process lifecycle
- **Container**: Dependency injection system that wires together all services and adapters

### Service Layer
- **Shared**: Adapter policies, filesystem abstractions, and cross-language debugging behaviors
- **Test-utils**: Mock generation infrastructure providing type-safe test doubles and standardized fixtures

### Protocol Layer
- **DAP-core**: Debug Adapter Protocol message handling, state management, and session coordination
- **Proxy**: DAP proxy subsystem managing debug session communication, connection resilience, and request tracking

### Adapter Layer
- **Adapters**: Dynamic adapter loading, registry management, and specialized implementations (JavaScript, Python, Mock)
- **Adapter-python**: Comprehensive Python debug adapter testing with debugpy integration

### Interface Layer
- **CLI**: Command-line interface with STDIO and SSE transport modes, version management, and error handling

### Integration Layer
- **Main Entry Point** (`index.test.ts`): Tests the primary CLI setup, command handling, and server factory
- **Server Coverage** (`server-coverage.test.ts`): Error paths and edge cases in the main DebugMcpServer
- **Session Manager** (`session-manager-operations-coverage.test.ts`): Session lifecycle and debugging operations

## Public API Surface

The test suite validates the primary entry points and interfaces:

### CLI Interface
- `createCLI()`: Main CLI setup with command registration
- `handleStdioCommand()`, `handleSSECommand()`: Transport-specific handlers
- `setupErrorHandlers()`, `getVersion()`: CLI infrastructure

### Server Interface
- `createDebugMcpServer()`: Main server factory
- `DebugMcpServer`: Core server class with session management and debugging operations

### Adapter System
- `AdapterLoader.loadAdapter()`: Dynamic adapter loading with fallback chains
- `AdapterRegistry.register()`: Adapter factory management
- Language-specific adapters (Python, JavaScript, Mock) with environment validation and feature support

### Session Management
- Debug session lifecycle (start, stop, pause, continue)
- Breakpoint management and expression evaluation
- Variable inspection and stack trace operations

## Key Testing Patterns & Infrastructure

### Mock Strategy
- **Auto-mock generation** (`test-utils/auto-mock.ts`): Type-safe mock creation from real implementations
- **Standardized factories** (`test-utils/mock-factories.ts`): Pre-configured mocks for core components
- **Comprehensive mocking**: File systems, processes, networks, and external dependencies fully isolated

### Test Organization
- **Environment isolation**: Process environment and global state management
- **Resource cleanup**: Systematic cleanup of mocks, timers, and test resources
- **Cross-platform support**: Platform-specific behavior validation and container mode testing

### Coverage Focus
- **Error handling**: Comprehensive error path testing and recovery scenarios
- **Edge cases**: Boundary conditions, timeout scenarios, and resource exhaustion
- **Integration**: Component interaction validation and end-to-end workflows
- **Performance**: Timeout management, retry logic, and resource cleanup

## Data Flow & Integration Points

The test suite validates the complete data flow:
1. **CLI → Container**: Command parsing and dependency injection
2. **Container → Server**: Service wiring and adapter registration  
3. **Server → Session Manager**: Debug session orchestration
4. **Session Manager → Proxy**: DAP protocol communication
5. **Proxy → Adapters**: Language-specific debug adapter interaction
6. **Adapters → Runtime**: Target language debugging integration

This comprehensive test suite ensures the Debug MCP Server can reliably manage debugging sessions across multiple programming languages while providing robust error handling, proper resource cleanup, and seamless integration between CLI interfaces and debugging protocols.