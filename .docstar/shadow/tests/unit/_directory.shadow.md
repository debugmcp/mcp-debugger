# tests\unit/
@children-hash: 09c3dbd50c9e9a4e
@generated: 2026-02-24T21:15:34Z

## Overall Purpose and Responsibility

The `tests/unit` directory provides comprehensive unit test coverage for the entire debugMCP system, ensuring reliable debug session management, protocol compliance, and robust error handling across all components. The test suite validates the complete MCP (Model Context Protocol) debugging infrastructure from CLI entry points through adapter implementations to low-level utilities.

## Key Components and Architecture

### Test Organization Structure
The directory is organized into logical layers that mirror the system architecture:

- **Entry Points** (`index.test.ts`): Tests main application orchestration and CLI initialization
- **Core Services** (`server-coverage.test.ts`, `session-manager-operations-coverage.test.ts`): Validates debug server operations and session lifecycle management
- **CLI Interface** (`cli/`): Tests command-line parsing, transport modes (STDIO/SSE), and user interaction
- **Adapter System** (`adapters/`, `adapter-python/`): Tests dynamic adapter loading, registration, and language-specific implementations
- **Protocol Layer** (`dap-core/`, `proxy/`): Tests Debug Adapter Protocol (DAP) message handling and proxy communication
- **Infrastructure** (`implementations/`, `shared/`, `utils/`): Tests system abstractions, filesystem operations, and utilities
- **Test Utilities** (`test-utils/`): Mock generation infrastructure and testing helpers
- **Container Support** (`container/`): Tests dependency injection and containerized deployment

### Integration Flow
The test suite validates the complete data flow from CLI entry through debug session execution:
1. **CLI Layer**: Command parsing → Transport setup → Server initialization
2. **Session Layer**: Session creation → Adapter selection → Debug target connection
3. **Protocol Layer**: DAP message routing → Proxy management → Response correlation
4. **Adapter Layer**: Language-specific debugging → Breakpoint management → Variable inspection
5. **Infrastructure Layer**: File operations → Process management → Network communication

## Public API Surface (Main Entry Points)

### Primary Test Targets
- **`src/index.js`**: Main application entry point with CLI orchestration
- **`DebugMcpServer`**: Core debug server managing sessions and adapters
- **CLI Commands**: STDIO and SSE transport mode handlers
- **Adapter System**: Dynamic language adapter loading and registration
- **ProxyManager**: DAP proxy communication and request handling
- **SessionManager**: Debug session lifecycle and state management

### Test Infrastructure APIs
- **Mock Generation**: `createMockFromInterface<T>()` for type-safe test doubles
- **Mock Factories**: Pre-configured mocks for standard system components
- **Test Utilities**: Specialized test doubles like `TestProxyManager`
- **Environment Mocking**: Container mode simulation and environment isolation

## Internal Organization and Data Flow

### Testing Strategy
The test suite employs a comprehensive multi-layered approach:

1. **Unit Isolation**: Each component tested in isolation with extensive mocking
2. **Integration Validation**: Cross-component interaction testing through dependency injection
3. **Error Path Coverage**: Comprehensive testing of failure scenarios and edge cases
4. **Protocol Compliance**: DAP specification adherence validation
5. **Container Support**: Dual testing for host and containerized environments

### Mock Infrastructure
Sophisticated mocking system enables reliable test execution:
- **Automatic Mock Generation**: Interface-based mock creation with validation
- **Dependency Injection**: All external dependencies injectable for test isolation
- **Event Simulation**: EventEmitter patterns for async operation testing
- **Timer Control**: Fake timers for deterministic timeout and retry testing

### Cross-Cutting Concerns
Common testing patterns throughout the suite:
- **Environment Management**: Process environment variable isolation and restoration
- **Resource Cleanup**: Systematic cleanup of mocks, timers, and test state
- **Error Handling**: Comprehensive error scenario validation with user-friendly messaging
- **Container Awareness**: Dual-mode testing for host vs containerized deployment

## Important Patterns and Conventions

### Test Structure
- **Comprehensive Setup**: `beforeEach`/`afterEach` hooks for consistent test isolation
- **Mock Factories**: Centralized mock creation with realistic default behaviors
- **Error Scenarios**: Extensive failure path testing alongside happy path validation
- **Async Patterns**: Proper handling of Promise-based operations and event-driven flows

### Coverage Strategy
The test suite prioritizes:
- **Error Path Coverage**: Testing failure scenarios that are difficult to reproduce in production
- **Edge Case Validation**: Boundary conditions and unusual input handling
- **Protocol Compliance**: Ensuring DAP specification adherence across all operations
- **Cross-Platform Support**: Validating behavior across different operating systems and environments

This comprehensive test suite ensures the debugMCP system provides reliable, robust debugging capabilities across multiple programming languages while maintaining proper error handling, resource cleanup, and user experience throughout the debugging workflow.