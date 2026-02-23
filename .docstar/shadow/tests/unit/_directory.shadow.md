# tests\unit/
@children-hash: 9154378013728777
@generated: 2026-02-23T15:26:57Z

## Overall Purpose

The `tests/unit` directory provides comprehensive unit test coverage for the entire Debug MCP Server system, ensuring reliable debugging functionality across multiple programming languages through extensive mocking and isolated component testing. This test suite validates the complete architecture from CLI entry points through debug adapter implementations, session management, and core debugging protocols.

## Key Components and Architecture

### Core System Integration Tests
- **index.test.ts**: Entry point validation testing CLI setup, command handling, and server factory functionality
- **server-coverage.test.ts**: Comprehensive DebugMcpServer error paths and edge case testing
- **session-manager-operations-coverage.test.ts**: Session lifecycle management and debugging operation error scenarios
- **container/**: Dependency injection container testing ensuring proper service wiring and adapter registration

### Debug Protocol Implementation
- **dap-core/**: Debug Adapter Protocol message handling and immutable state management testing
- **proxy/**: DAP proxy subsystem testing including connection management, message parsing, and process lifecycle
- **shared/**: Cross-language adapter policy validation and filesystem abstraction testing

### Language-Specific Adapters
- **adapter-python/**: Complete Python debug adapter test suite with debugpy integration and environment validation
- **adapters/**: Multi-language adapter system testing including JavaScript, Mock adapters, and adapter registry management

### CLI and Transport Layer
- **cli/**: Command-line interface testing covering STDIO and Server-Sent Events transport modes, error handling, and utility commands

### Supporting Infrastructure
- **implementations/**: Concrete implementation testing for file system, network, process management, and environment abstractions
- **utils/**: Utility module testing for path resolution, error handling, logging, and language configuration
- **test-utils/**: Comprehensive testing infrastructure providing mock generation, interface validation, and standardized test fixtures

## Public API Surface

### Primary Entry Points
- **Main Server API**: `createDebugMcpServer()` factory and server lifecycle methods
- **CLI Commands**: STDIO (`handleStdioCommand`) and SSE (`handleSSECommand`) transport modes
- **Adapter System**: Dynamic adapter loading, registration, and language-specific debugging capabilities
- **Session Management**: Debug session creation, lifecycle management, and operation handling

### Core Debugging Capabilities
- **Multi-Language Support**: Python, JavaScript/Node.js debugging with extensible adapter architecture
- **Transport Protocols**: Standard I/O and Server-Sent Events for different integration scenarios
- **Debug Operations**: Breakpoint management, step operations, variable inspection, expression evaluation
- **Session Coordination**: Multi-session debugging with proper isolation and resource management

## Internal Organization and Data Flow

### Testing Architecture
1. **Mock Infrastructure**: Extensive mocking system using Vitest with auto-generated, validated mocks ensuring type safety and interface consistency
2. **Isolation Strategy**: Each test component uses dependency injection with comprehensive mock setup to prevent cross-test contamination
3. **Coverage Focus**: Error paths, edge cases, and failure scenarios alongside happy-path validation

### Integration Flow
1. **CLI Layer**: Commands parse arguments and initialize appropriate transport mechanisms
2. **Server Core**: DebugMcpServer coordinates session management and adapter interactions
3. **Adapter System**: Language-specific adapters handle debug protocol translation and runtime integration
4. **Proxy Layer**: DAP proxy manages debug session communication and state tracking
5. **Infrastructure**: File system, network, and process management provide platform abstraction

### Error Handling and Resilience
- **Comprehensive Error Scenarios**: Tests validate graceful degradation, error message translation, and user-friendly feedback
- **Resource Management**: Proper cleanup testing ensures no resource leaks during error conditions
- **Container Awareness**: Tests validate behavior in both containerized and host environments

## Critical Testing Patterns

### Mock Management
- **Automated Mock Generation**: Type-safe mock creation with interface validation
- **Standardized Factories**: Consistent mock objects across test suites
- **Event-Driven Testing**: Comprehensive EventEmitter pattern testing for async operations

### State Validation
- **Immutability Enforcement**: State management tests ensure no accidental mutations
- **Lifecycle Tracking**: Session and process lifecycle validation with proper cleanup
- **Concurrent Operation Handling**: Tests for race conditions and simultaneous operation scenarios

This test suite ensures the Debug MCP Server provides reliable, multi-language debugging capabilities with robust error handling, proper resource management, and seamless integration across different deployment environments and transport protocols.