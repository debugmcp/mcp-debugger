# tests/core/
@generated: 2026-02-11T23:48:28Z

## Purpose and Responsibility

The `tests/core` directory contains the complete test suite for the core debug adapter infrastructure of the @debugmcp/shared package. This test suite validates the foundational system that enables AI agents to perform debugging operations across multiple programming languages through the Model Context Protocol (MCP). It ensures type safety, API stability, and robust error handling for the entire debug infrastructure that bridges AI agents with language-specific debuggers.

## Key Components Integration

### Comprehensive Testing Architecture
The test suite validates a four-layer architecture through unit tests:

1. **Interface Layer** (`unit/adapters/`) - Validates foundational contracts including adapter states, error codes, debug features, and configuration types that establish the protocol between debug adapters and the MCP system
2. **Factory Layer** (`unit/factories/`) - Tests object creation patterns with dependency injection for ProxyManager and SessionStore instances, plus comprehensive mock implementations
3. **Service Layer** (`unit/session/`) - Core business logic testing with Debug Adapter Protocol (DAP) integration, state machine integrity, and multi-session coordination
4. **Protocol Layer** (`unit/server/`) - Complete MCP server functionality testing including lifecycle management and 14 debugging tool handlers
5. **Utility Layer** (`unit/utils/`) - Cross-cutting concerns like type validation, runtime guards, and API migration support

### Data Flow Validation
Tests ensure proper data flow through the system:
- **Request Processing**: MCP tool requests → SessionManager operations → DAP commands → Adapter responses
- **State Management**: Session lifecycle states with proper transitions and error recovery
- **Type Safety**: Runtime validation at IPC boundaries with comprehensive serialization testing
- **Error Propagation**: End-to-end error handling from adapter failures to MCP response formatting

## Public API Surface Testing

### MCP Debug Tools Validation (14 total)
The test suite validates the complete debugging interface:
- **Session Management**: `create_debug_session`, `list_debug_sessions`, `close_debug_session`
- **Execution Control**: `set_breakpoint`, `start_debugging`, `step_over/into/out`, `continue/pause_execution` 
- **Runtime Inspection**: `get_variables`, `get_stack_trace`, `get_scopes`, `evaluate_expression`, `get_source_context`

### Core System Components Testing
- **Adapter Interface**: Complete validation of enums (`AdapterState`, `AdapterErrorCode`, `DebugFeature`), error classes, and configuration types
- **Factory System**: Creation patterns with `ProxyManagerFactory.create()`, `SessionStoreFactory.create()` and mock implementations
- **Session Management**: SessionManager lifecycle operations with DAP integration validation
- **Type Safety**: Runtime type guards and validation utilities for reliable IPC communication

## Internal Organization and Testing Patterns

### Mock Infrastructure
- Centralized mock factory system providing consistent dependency injection across all test files
- Comprehensive mock implementations for ProxyManager, SessionStore, and external dependencies
- State tracking and call monitoring for thorough test introspection and validation

### Quality Assurance Conventions
- **Vitest Framework**: Consistent testing framework with `vi.mock()` and fake timers across all test files
- **Lifecycle Management**: Proper setup/teardown with beforeEach/afterEach patterns ensuring test isolation
- **Error Boundary Testing**: Comprehensive validation of both parameter validation errors and operational failures
- **Cross-Platform Support**: Path resolution and environment handling across different operating systems

### System Reliability Validation
Tests ensure critical system reliability aspects:
- **Multi-Session Isolation**: Concurrent debugging sessions maintain independent state without interference
- **Graceful Degradation**: System continues operating despite individual component failures
- **Resource Cleanup**: Proper event listener management and process termination validation
- **Error Recovery**: Adapter crashes and timeout scenarios with automatic recovery testing
- **Performance Validation**: Large dataset testing ensuring type guards and validation scale appropriately

## Critical Integration Testing

The test suite validates key integration patterns essential for production reliability:
- **Type Safety Focus**: Runtime type checking with TypeScript narrowing validation at all system boundaries
- **API Evolution**: Migration testing ensuring backward compatibility while enforcing new patterns
- **State Machine Integrity**: Comprehensive state transition validation with error recovery scenarios
- **Resource Management**: Memory leak prevention and proper cleanup verification across all components

This comprehensive test suite ensures the debug adapter system provides a robust, type-safe, and reliable foundation for AI agents to perform debugging operations across multiple programming languages through the Model Context Protocol, with full validation of the four-layer architecture and all 14 debugging tools.