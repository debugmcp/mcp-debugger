# tests\unit/
@children-hash: a91e5fd0545d8bcc
@generated: 2026-02-15T09:02:06Z

## Overall Purpose and Responsibility

The `tests/unit` directory provides comprehensive unit test coverage for the Debug MCP Server, validating all core components, services, and subsystems that enable debugging capabilities across multiple programming languages in containerized and non-containerized environments. This test suite ensures reliability, error handling, and proper integration of the debugging infrastructure that bridges VS Code's Debug Adapter Protocol (DAP) with various language-specific debuggers.

## Key Components and Integration

### Core System Testing
- **Entry Point Validation** (`index.test.ts`): Tests main CLI setup, command handling, and server factory functionality
- **Dependency Injection** (`container/`): Validates the production dependency wiring that connects all services, adapters, and utilities
- **CLI Interface** (`cli/`): Comprehensive testing of command-line functionality including STDIO and SSE transport modes
- **Server Coverage** (`server-coverage.test.ts`): Tests error paths and edge cases in the main DebugMcpServer

### Debugging Infrastructure
- **Session Management** (`session-manager-operations-coverage.test.ts`): Tests debug session lifecycle, proxy operations, timeout handling, and toolchain validation
- **DAP Protocol Core** (`dap-core/`): Validates message handling, state management, and event forwarding for Debug Adapter Protocol communication
- **Proxy System** (`proxy/`): Tests the DAP proxy subsystem that manages connections, message parsing, request tracking, and process lifecycle

### Adapter System Architecture
- **Adapter Management** (`adapters/`): Tests dynamic adapter loading, registration, lifecycle management, and error handling
- **Language-Specific Adapters** (`adapter-python/`): Comprehensive testing of Python debug adapter implementation with debugpy integration
- **Shared Debugging Infrastructure** (`shared/`): Tests adapter policies, filesystem abstractions, and cross-language debugging behaviors

### Foundation Layer
- **Implementation Testing** (`implementations/`): Validates concrete implementations of system abstractions (file system, network, process management)
- **Utility Functions** (`utils/`): Tests core utilities for path resolution, error handling, logging, and configuration in container environments
- **Test Infrastructure** (`test-utils/`): Provides automated mock generation, interface validation, and standardized test fixtures

## Public API Surface

### Main Entry Points
- **Server Factory**: `createDebugMcpServer()` with comprehensive options validation
- **CLI Commands**: STDIO and SSE transport handlers with configuration management
- **Adapter System**: Dynamic adapter loading (`loadAdapter`), registration (`AdapterRegistry`), and lifecycle management
- **Session Management**: Debug session operations, breakpoint management, variable inspection, and execution control

### Core Services
- **Proxy Management**: `ProxyManager` for DAP communication, connection handling, and message routing
- **Session Operations**: Debug session lifecycle, stepping operations, stack inspection, and expression evaluation
- **Transport Layer**: Multiple transport implementations (STDIO, SSE) with proper error handling and cleanup

### Utility Interfaces
- **Path Resolution**: Container-aware path utilities for workspace management
- **File Operations**: Line reading, existence checking, and binary detection
- **Error Handling**: Standardized error messages and logging infrastructure
- **Configuration**: Environment-based language configuration and feature toggles

## Internal Organization and Data Flow

### Test Architecture Patterns
- **Comprehensive Mocking**: Uses Vitest framework with extensive mock infrastructure to isolate components
- **Environment Management**: Sophisticated test environment setup with container mode simulation
- **Error Path Coverage**: Focused testing on error conditions, timeouts, and edge cases
- **Integration Testing**: Validates component interactions while maintaining unit test isolation

### Data Flow Validation
1. **CLI Layer**: Command parsing → transport selection → server initialization
2. **Session Layer**: Session creation → adapter selection → proxy management → DAP communication
3. **Protocol Layer**: Message parsing → request routing → response handling → event propagation
4. **Adapter Layer**: Language detection → debugger integration → protocol translation

### Critical Test Behaviors
- **Resource Management**: Proper cleanup of processes, connections, and temporary resources
- **Concurrent Operations**: Thread safety and race condition handling in multi-session scenarios
- **Error Recovery**: Graceful degradation and user-friendly error reporting
- **Cross-Platform Compatibility**: Validation across different operating systems and container environments

## Important Patterns and Conventions

### Mock Strategy
- **Dependency Injection**: All external dependencies mocked for isolated testing
- **Event-Driven Testing**: Comprehensive EventEmitter simulation for async component testing  
- **Fake Timer Management**: Deterministic timeout and retry logic testing
- **Type-Safe Mocking**: Consistent TypeScript integration with Vitest mocking capabilities

### Coverage Philosophy
- **Happy Path + Error Paths**: Balanced testing of both success scenarios and failure conditions
- **Boundary Testing**: Edge cases, resource limits, and invalid input handling
- **Integration Points**: Validation of component interfaces and protocol compliance
- **Container Awareness**: Dual testing for both host and containerized execution modes

This comprehensive test suite ensures the Debug MCP Server provides reliable, cross-language debugging capabilities with robust error handling, proper resource management, and seamless integration across different development environments.