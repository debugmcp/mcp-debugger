# tests\core/
@children-hash: 19d30194fe459bce
@generated: 2026-02-19T23:48:52Z

## Purpose and Responsibility

The `tests/core` directory serves as the comprehensive testing foundation for the DebugMCP system's core architecture. This test suite validates the complete debugging framework that enables AI agents to manage debugging sessions through the Model Context Protocol (MCP). The directory ensures the system's foundational components are reliable, type-safe, and protocol-compliant across all layers of the debugging infrastructure.

## Key Components and Integration

### Hierarchical Testing Architecture
The `tests/core` directory currently contains the `unit/` subdirectory, which provides exhaustive unit test coverage for all core components:

- **Protocol Layer Testing**: Validates debug adapter interface contracts and protocol compliance across 20+ debugging features
- **Service Layer Testing**: Comprehensive MCP Debug Server validation including 14 debugging tools and AI agent interactions
- **Session Management Testing**: Complete lifecycle testing for debug sessions, state transitions, and DAP operations
- **Infrastructure Testing**: Factory pattern validation for dependency injection and core utility testing for runtime safety

### Component Integration Flow
The test components work together to validate the complete system architecture:

1. **Foundation Validation**: Type safety, interface contracts, and utility functions ensure system reliability
2. **Service Integration**: MCP server tools are tested for proper AI agent interaction and structured JSON responses
3. **Session Lifecycle**: End-to-end testing of debug session creation, management, and termination
4. **Error Resilience**: Comprehensive error scenario testing with graceful degradation patterns

## Public API Surface Validation

### MCP Debug Server Tools (14 total tested)
- **Session Management**: `create_debug_session`, `list_debug_sessions`, `close_debug_session`
- **Debug Control**: `set_breakpoint`, `start_debugging`, stepping operations, `continue_execution`
- **Inspection Tools**: `get_variables`, `get_stack_trace`, `get_scopes`, `evaluate_expression`
- **Discovery Services**: Language detection and adapter registry integration

### Core Factory Interfaces
- `IProxyManagerFactory.create()`: Proxy manager instantiation with dependency injection
- `ISessionStoreFactory.create()`: Session store creation with debug language support

### Runtime Safety APIs
- Type guards for `AdapterCommand` and `ProxyInitPayload` validation
- Serialization/deserialization with consistency verification
- API migration validation (`pythonPath` → `executablePath`)

## Internal Organization and Data Flow

The `tests/core` directory follows a structured validation approach:

1. **Unit Testing Layer** (`unit/`): Comprehensive component-level testing
   - Interface and contract validation
   - Service implementation testing
   - Session management verification
   - Factory pattern and utility validation

2. **Mock Infrastructure**: Centralized mocking system across all tests
   - Shared mock factories using `createMockDependencies()`
   - State tracking and call history maintenance
   - Test isolation with independent mock states

3. **Quality Assurance Patterns**:
   - Protocol compliance validation
   - Error resilience testing
   - Memory safety and resource cleanup verification
   - Cross-platform compatibility testing

## Testing Conventions and Patterns

### Standardized Testing Approach
- **Consistent Lifecycle**: Uniform `beforeEach/afterEach` setup with mock creation and cleanup
- **Error Evolution**: Tests validate migration from exception throwing to graceful error responses
- **Type Safety**: Runtime type checking integrated with TypeScript compiler validation
- **Performance Validation**: Large dataset testing and memory leak prevention

### Coverage Philosophy
- **Complete Interface Coverage**: All debug adapter definitions validated for structure and type safety
- **End-to-End Workflows**: Session lifecycle from creation through termination
- **Multi-Session Scenarios**: Concurrent session handling with proper state isolation
- **Error Recovery**: Comprehensive testing of proxy crashes, timeouts, and network failures

This testing directory ensures the DebugMCP system provides a robust, reliable, and performant foundation for AI-driven debugging capabilities through comprehensive validation of all core components and their interactions.