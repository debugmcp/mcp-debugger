# tests\core\unit/
@children-hash: d5179e82e54e32c6
@generated: 2026-02-19T23:48:38Z

## Purpose and Responsibility

The `tests/core/unit` directory provides comprehensive unit test coverage for the core components of the DebugMCP system. This test suite validates the foundational architecture that enables AI agents to manage debugging sessions through the Model Context Protocol (MCP). The tests ensure type safety, protocol compliance, error resilience, and proper component integration across the entire debugging framework.

## Key Components and Integration

### Architectural Validation
- **adapters/**: Tests the shared debug adapter interface contracts, validating protocol compliance, state management, and feature coverage across 20+ debug protocol features
- **server/**: Comprehensive MCP Debug Server testing including 14 debugging tools, lifecycle management, and AI agent interaction through structured JSON responses
- **session/**: Complete SessionManager testing covering debug session lifecycle, state transitions, DAP operations, error recovery, and multi-session scenarios
- **factories/**: Factory pattern validation for dependency injection and component creation with comprehensive mock testing infrastructure
- **utils/**: Core utility testing for runtime type safety, API migration compliance, and data validation at system boundaries

### Component Integration Flow
The test components work together to validate the complete debugging system:

1. **Protocol Layer**: `adapters/` tests ensure interface contracts are properly defined and enforced
2. **Service Layer**: `server/` tests validate MCP tool implementations and AI agent interactions  
3. **Session Layer**: `session/` tests ensure robust session management and DAP protocol handling
4. **Infrastructure Layer**: `factories/` and `utils/` tests validate dependency injection and runtime safety

## Public API Surface Testing

### MCP Debug Server Tools (14 total)
- **Session Management**: `create_debug_session`, `list_debug_sessions`, `close_debug_session`
- **Debug Control**: `set_breakpoint`, `start_debugging`, stepping operations, `continue_execution`  
- **Inspection**: `get_variables`, `get_stack_trace`, `get_scopes`, `evaluate_expression`
- **Discovery**: Language detection and adapter registry integration

### Core Factory Interfaces
- `IProxyManagerFactory.create()`: Proxy manager instantiation with dependency injection
- `ISessionStoreFactory.create()`: Session store creation with debug language support

### Runtime Safety Utilities
- Type guards for `AdapterCommand` and `ProxyInitPayload` validation
- Serialization/deserialization with round-trip consistency
- Session parameter migration (`pythonPath` → `executablePath`) validation

## Testing Architecture Patterns

### Mock Infrastructure
- **Centralized Mocking**: Shared mock factories across all test suites using `createMockDependencies()`
- **State Tracking**: Mock implementations maintain call history and instance tracking
- **Isolation**: Each test maintains independent mock state for reliable testing

### Quality Assurance Focus
- **Protocol Compliance**: Validates MCP request/response structures and error codes
- **Error Resilience**: Comprehensive error scenario testing with graceful degradation
- **State Management**: Session lifecycle and debug state transition validation
- **Memory Safety**: Event listener cleanup and resource management testing
- **Cross-Platform**: Path resolution and environment compatibility testing

### Coverage Areas
- **Interface Contracts**: All debug adapter definitions properly structured and type-safe
- **Lifecycle Management**: Complete session creation through termination workflows
- **Protocol Operations**: DAP command handling, breakpoints, variable inspection, stack traces
- **Multi-Session**: Concurrent session handling with proper state isolation
- **Error Recovery**: Proxy crashes, timeouts, and network failure scenarios

## Internal Organization

The test directory follows a hierarchical validation approach:
1. **Foundation**: Type safety and interface validation (`adapters/`, `utils/`)
2. **Core Services**: Session management and factory pattern validation (`session/`, `factories/`)
3. **Integration**: Complete system testing through MCP server tools (`server/`)

Each component provides comprehensive mock utilities and follows consistent testing patterns using Vitest framework with fake timers, console spying, and dependency injection mocking.

## Key Testing Conventions

- **Consistent Setup**: Standardized `beforeEach/afterEach` lifecycle with mock creation and cleanup
- **Error Response Evolution**: Tests show migration from exception throwing to graceful error responses
- **Environment Agnostic**: Cross-platform compatibility validation
- **Performance Validation**: Large dataset testing and memory leak prevention
- **Type Safety**: Runtime type checking with TypeScript compiler integration

This comprehensive unit test suite ensures the DebugMCP system provides reliable, type-safe, and performant debugging capabilities for AI agents through the MCP protocol.