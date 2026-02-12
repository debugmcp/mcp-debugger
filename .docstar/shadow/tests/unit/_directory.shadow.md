# tests\unit/
@generated: 2026-02-12T21:01:34Z

## Purpose and Scope

The `tests/unit` directory provides comprehensive unit test coverage for the entire Debug MCP Server system, validating all core functionality through isolated testing with extensive mocking. This test suite ensures the reliability of multi-language debugging capabilities, adapter management, CLI interfaces, and supporting infrastructure through systematic validation of both happy-path scenarios and edge cases.

## Overall Architecture and Integration

The test suite mirrors the production system's layered architecture:

### Foundation Layer
- **Utils Tests**: Core infrastructure including logging, file operations, container-aware path resolution, and environment configuration
- **Implementations Tests**: System interface implementations (filesystem, process management, network operations) with comprehensive Node.js integration mocking
- **Container Tests**: Dependency injection system validation ensuring proper service wiring and adapter registration

### Protocol and Communication Layer  
- **DAP Core Tests**: Debug Adapter Protocol message handling, state management, and proxy communication infrastructure
- **Proxy Tests**: Complete DAP proxy system including connection management, message routing, process lifecycle, and retry logic
- **Shared Tests**: Adapter policy pattern validation and filesystem abstractions supporting pluggable language-specific debugging behaviors

### Application Layer
- **CLI Tests**: Command-line interface validation for STDIO/SSE transport modes, utility commands, and global error handling
- **Server Coverage Tests**: DebugMcpServer error paths, edge cases, and boundary conditions with comprehensive session management testing
- **Session Manager Tests**: Session lifecycle operations, proxy management, timeout handling, and debugging state transitions

### Adapter System Layer
- **Adapters Tests**: Core adapter infrastructure (loading, registration, lifecycle) and language-specific implementations
- **Adapter-Python Tests**: Complete Python debugging adapter validation with debugpy integration and environment management

### Integration and Testing Infrastructure
- **Test Utils**: Sophisticated mock generation system with type safety, automated validation, and specialized test implementations
- **Main Entry Point Tests**: End-to-end CLI setup, command handling, and server factory functionality

## Key Testing Patterns and Public API

### Mock Architecture Strategy
The entire test suite employs a sophisticated mocking strategy:
- **Type-Safe Mock Generation**: Automated creation of typed mocks from interfaces with validation
- **Comprehensive Dependency Injection**: All external dependencies (filesystem, network, processes, loggers) are mockable
- **EventEmitter Simulation**: Extensive use of event-driven patterns for testing async communication and lifecycle management
- **Isolation Guarantees**: Each test maintains complete isolation through systematic mock reset and cleanup

### Primary Entry Points Tested
- **CLI Interface**: `main()` function, command setup, transport modes (stdio/SSE), utility commands
- **Server Factory**: `createDebugMcpServer()` with configuration and transport abstraction
- **Session Management**: Complete debugging session lifecycle from creation through cleanup
- **Adapter System**: Dynamic adapter loading, registration, and language-specific debugging capabilities
- **DAP Communication**: Full Debug Adapter Protocol implementation with message routing and state management

### Cross-Component Validation
Tests validate critical integration points:
- CLI commands properly initialize servers with correct transport modes
- Adapter registry correctly loads and manages language-specific debugging adapters
- Session managers coordinate with proxy systems for debug communication
- DAP core handles message routing between clients and debug adapters
- Container-aware utilities adapt behavior based on deployment context

## Testing Framework Integration

### Vitest-Centric Approach
- **Mocking Infrastructure**: Extensive use of `vi.mock()`, `vi.fn()`, and fake timers for deterministic testing
- **Async Testing**: Comprehensive Promise-based assertions with proper error propagation
- **Environment Control**: Process environment manipulation with automatic restoration
- **Resource Management**: Systematic cleanup patterns preventing test pollution

### Coverage Strategy
- **Error Path Testing**: Extensive validation of failure scenarios, timeout conditions, and edge cases
- **Boundary Testing**: Input validation, resource limits, and state transition edge cases  
- **Integration Scenarios**: Multi-component interaction testing while maintaining unit test isolation
- **Platform Compatibility**: Cross-platform testing with environment-specific behavior validation

The unit test directory serves as the quality assurance foundation for the Debug MCP Server, ensuring reliable multi-language debugging capabilities through comprehensive validation of all system components, from low-level utilities to high-level debugging orchestration.