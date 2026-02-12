# tests/core/unit/
@generated: 2026-02-11T23:48:14Z

## Purpose and Responsibility

This directory contains the comprehensive unit test suite for the core module of the @debugmcp/shared package. It validates the foundational debug adapter system that enables AI agents to perform debugging operations across multiple programming languages through the Model Context Protocol (MCP). The tests ensure type safety, API stability, and robust error handling for the entire debug infrastructure.

## Key Components and Integration

### Core Debug Infrastructure Testing
- **Adapter Interface Validation** (`adapters/`): Tests the foundational contracts defining adapter states, error codes, debug features, and configuration types that establish the protocol between debug adapters and the MCP system
- **Factory Pattern Implementation** (`factories/`): Validates factory classes for creating ProxyManager and SessionStore instances, along with comprehensive mock implementations for testing infrastructure
- **Server Implementation** (`server/`): Complete MCP server functionality testing including lifecycle management, tool handlers (14 debugging tools), session management, and language discovery
- **Session Management** (`session/`): Comprehensive SessionManager testing covering Debug Adapter Protocol (DAP) operations, state machine integrity, multi-session coordination, and error recovery

### System Utilities and Migration
- **Runtime Validation** (`utils/`): Type guards, data validation, and API migration verification ensuring type safety at IPC boundaries and supporting parameter evolution across the system

## Public API Surface

The test suite validates the complete debug system interface:

### MCP Debug Tools (14 total)
- **Session Management**: `create_debug_session`, `list_debug_sessions`, `close_debug_session`
- **Execution Control**: `set_breakpoint`, `start_debugging`, `step_over/into/out`, `continue/pause_execution`
- **Runtime Inspection**: `get_variables`, `get_stack_trace`, `get_scopes`, `evaluate_expression`, `get_source_context`

### Core System Components
- **Adapter Interface**: Complete validation of enums (`AdapterState`, `AdapterErrorCode`, `DebugFeature`), error classes (`AdapterError`), and configuration types
- **Factory System**: `ProxyManagerFactory.create()`, `SessionStoreFactory.create()` with corresponding mock implementations
- **Session Management**: SessionManager lifecycle operations with DAP integration and state machine validation
- **Type Safety**: Runtime type guards and validation utilities for IPC communication and data serialization

## Internal Organization and Data Flow

### Testing Architecture Hierarchy
1. **Interface Layer** (`adapters/`) - Validates foundational contracts and type definitions
2. **Factory Layer** (`factories/`) - Tests object creation patterns with dependency injection
3. **Service Layer** (`session/`) - Core business logic with Debug Adapter Protocol integration
4. **Protocol Layer** (`server/`) - MCP server implementation with tool handler validation
5. **Utility Layer** (`utils/`) - Cross-cutting concerns like type validation and API migration

### Data Flow Validation
The test suite ensures proper data flow through the system:
- **Request Processing**: MCP tool requests → SessionManager operations → DAP commands → Adapter responses
- **State Management**: Session lifecycle states with proper transitions and error recovery
- **Type Safety**: Runtime validation at IPC boundaries with serialization/deserialization testing
- **Error Propagation**: Comprehensive error handling from adapter failures to MCP response formatting

## Critical Integration Patterns

### Mock Infrastructure
- Centralized mock factory system providing consistent dependency injection across all test files
- Comprehensive mock implementations for ProxyManager, SessionStore, and all external dependencies
- State tracking and call monitoring for thorough test introspection

### Testing Conventions
- **Vitest Framework**: Consistent use across all test files with `vi.mock()` and fake timers
- **Lifecycle Management**: Proper setup/teardown with beforeEach/afterEach patterns
- **Error Boundary Testing**: Validation of both parameter validation errors and operational failures
- **Cross-Platform Support**: Path resolution and environment handling across different operating systems

### Quality Assurance Patterns
- **Type Safety Focus**: Runtime type checking with TypeScript narrowing validation
- **Resource Management**: Memory leak prevention and proper cleanup verification
- **State Machine Integrity**: Comprehensive state transition validation with error recovery
- **API Evolution**: Migration testing ensuring backward compatibility while enforcing new patterns

## System Reliability Features

The test suite validates critical system reliability aspects:
- **Multi-Session Isolation**: Concurrent debugging sessions maintain independent state
- **Graceful Degradation**: System continues operating despite individual component failures
- **Resource Cleanup**: Proper event listener management and process termination
- **Error Recovery**: Adapter crashes and timeout scenarios with automatic recovery
- **Performance Validation**: Large dataset testing to ensure type guards and validation scale appropriately

This comprehensive test suite ensures the debug adapter system provides a robust, type-safe, and reliable foundation for AI agents to perform debugging operations across multiple programming languages through the Model Context Protocol.