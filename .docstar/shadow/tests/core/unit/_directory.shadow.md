# tests\core\unit/
@children-hash: 1cd472f1aa477475
@generated: 2026-02-15T09:01:52Z

## Overall Purpose

The `tests/core/unit` directory provides comprehensive unit test coverage for the core debugMCP system components. This test suite validates the foundational debug adapter interfaces, factory patterns, MCP server implementation, session management, and utility functions that enable AI agents to perform debugging operations through the Model Context Protocol.

## Key Components and Integration

### Component Architecture
The directory is organized into five major test modules that mirror the core system architecture:

- **adapters/**: Tests debug adapter protocol contracts and interface definitions from @debugmcp/shared
- **factories/**: Validates factory pattern implementations for creating proxy managers and session stores
- **server/**: Tests the MCP Debug Server that exposes debugging capabilities through protocol tools
- **session/**: Comprehensive session lifecycle management and DAP (Debug Adapter Protocol) operations testing
- **utils/**: Tests utility functions for type safety, API migration, and data validation

### Integration Flow
These components work together to enable the complete debugging workflow:

1. **Protocol Foundation**: `adapters/` tests ensure type-safe communication contracts
2. **Object Creation**: `factories/` tests validate dependency injection and instance creation
3. **Protocol Interface**: `server/` tests verify MCP tool handlers expose debugging operations to AI agents
4. **Session Orchestration**: `session/` tests validate the core SessionManager that coordinates debugging operations
5. **Runtime Safety**: `utils/` tests ensure type guards and data validation protect system boundaries

## Public API Surface

### MCP Protocol Tools (Primary Entry Points)
The server tests validate 14+ MCP tools that form the public API for AI agents:

**Session Management**
- `create_debug_session`: Initialize debugging sessions with language detection
- `list_debug_sessions`: Enumerate active debugging sessions
- `close_debug_session`: Clean up debugging sessions

**Debugging Control**
- `set_breakpoint`: Manage breakpoints with conditional support
- `start_debugging`: Begin script execution in debug mode
- `step_over/step_into/step_out`: Control execution stepping
- `continue_execution`: Resume execution flow
- `pause_execution`: Pause debugging operations

**Code Inspection**
- `get_variables`: Inspect variable values in debugging context
- `get_stack_trace`: Retrieve execution stack information
- `get_scopes`: Access debugging scopes and contexts
- `evaluate_expression`: Execute expressions in debug environment
- `get_source_context`: Access source code context

### Core Factory Interfaces
- `IProxyManagerFactory.create()`: Creates debug proxy manager instances
- `ISessionStoreFactory.create()`: Creates session storage with language support

### Session Management API
- SessionManager lifecycle operations (create, initialize, run, terminate)
- DAP protocol operations (breakpoints, stepping, variable inspection)
- Multi-session concurrency with state isolation

## Internal Organization

### Testing Architecture Patterns
- **Centralized Mocking**: Shared mock factories provide consistent test environments across all components
- **Vitest Framework**: Unified testing approach with fake timers and comprehensive assertion support
- **Mock Dependency Injection**: Isolated testing through systematic mocking of external dependencies
- **State Machine Validation**: Comprehensive testing of state transitions and lifecycle management

### Quality Assurance Strategy
- **Contract Validation**: Interface and protocol compliance testing
- **Error Handling**: Comprehensive error scenario coverage with graceful degradation
- **Memory Management**: Leak prevention and resource cleanup validation
- **Concurrency Testing**: Multi-session scenarios and race condition handling
- **Platform Compatibility**: Cross-platform path handling and environment support

### Test Data Flow
1. Mock dependencies are created using centralized test helpers
2. Components are instantiated with injected mocks for isolation
3. Operations are tested through public APIs with state verification
4. Error scenarios validate proper error propagation and recovery
5. Cleanup ensures no resource leaks or state pollution between tests

## Important Conventions

### Testing Standards
- Environment isolation with proper setup/teardown lifecycle management
- Consistent mock verification patterns using `expect().toHaveBeenCalledWith()`
- Comprehensive error path testing alongside happy path scenarios
- Performance validation for type guards and high-throughput operations

### System Safety Patterns  
- Runtime type validation at system boundaries using validated type guards
- Progressive API migration support with backward compatibility testing
- Graceful error handling with detailed diagnostic information
- State consistency validation across concurrent operations

This unit test directory ensures the core debugMCP system provides reliable, type-safe debugging capabilities through the MCP protocol, with comprehensive validation of all major components from protocol contracts through session management to utility functions.