# tests/unit/
@generated: 2026-02-10T21:27:53Z

## Purpose
The `tests/unit` directory provides comprehensive unit test coverage for all core components of the MCP debug server system. It validates the complete debugging infrastructure including CLI interfaces, server functionality, debug adapters, proxy management, session handling, and supporting utilities through isolated unit testing.

## Overall Architecture and Component Integration

### Core System Testing
The test suite validates a multi-layered debugging architecture:
- **Entry Points** (`index.test.ts`): Tests CLI setup, command handling, and server factory functionality
- **Server Core** (`server-coverage.test.ts`): Validates `DebugMcpServer` error paths, session management, and debugging operations
- **Session Management** (`session-manager-operations-coverage.test.ts`): Tests proxy failures, network errors, timeout scenarios, and MSVC toolchain detection

### Debug Adapter Ecosystem
- **Adapter Infrastructure** (`adapters/`): Tests dynamic adapter loading, registration, lifecycle management, and language-specific implementations (JavaScript, Python, Mock)
- **Language Support** (`adapter-python/`): Comprehensive Python debug adapter testing with debugpy integration and environment validation
- **Policy System** (`shared/`): Tests polymorphic adapter policies enabling multi-language debugging with language-specific behaviors

### Communication and Protocol Layer
- **DAP Core** (`dap-core/`): Validates Debug Adapter Protocol message handling, state management, and protocol communication
- **Proxy System** (`proxy/`): Tests DAP proxy orchestration, connection management, message routing, and child session coordination
- **Transport Layer**: Validates STDIO and SSE communication modes with proper error handling and graceful shutdown

### Infrastructure and Utilities
- **CLI Interface** (`cli/`): Tests command-line functionality, transport modes, binary analysis, and error handling
- **Core Implementations** (`implementations/`): Validates process management, file system operations, network handling, and environment abstraction
- **Dependency Injection** (`container/`): Tests service wiring and adapter registration in production environments
- **Utilities** (`utils/`): Tests path resolution, file operations, logging, configuration management, and container-aware functionality

## Public API Surface Tested

### Primary Entry Points
- **Server Factory**: `createDebugMcpServer()` with comprehensive option validation
- **CLI Interface**: `createCLI()`, transport command setup (`setupStdioCommand`, `setupSSECommand`)
- **Session Management**: Debug session lifecycle, breakpoint operations, variable inspection
- **Adapter System**: Dynamic loading (`loadAdapter`), registration (`register`), and feature support validation

### Core Debugging Operations
- **Session Lifecycle**: Creation, initialization, configuration, debugging, and cleanup
- **Debug Commands**: Step operations, continue execution, breakpoint management, variable evaluation
- **Proxy Management**: DAP proxy startup, connection handling, message routing, and termination
- **Error Handling**: Timeout management, connection failures, and graceful degradation

### Infrastructure Interfaces
- **File System**: Path operations, existence checking, content reading with container awareness
- **Process Management**: Spawning, lifecycle control, signal handling, and IPC communication
- **Network Services**: Server creation, port discovery, and connection management
- **Configuration**: Environment-based settings, language configuration, and feature toggles

## Component Relationships and Data Flow

### Request Processing Flow
1. **CLI Entry** → **Server Factory** → **Debug Server Instance**
2. **Debug Requests** → **Session Manager** → **Proxy Manager** → **Debug Adapters**
3. **DAP Communication** → **Message Parser** → **Protocol Handler** → **Adapter Response**
4. **Error Handling** → **Standardized Messages** → **User Feedback**

### Adapter Integration Pipeline
1. **Dynamic Loading** → **Registry Validation** → **Lifecycle Management**
2. **Language Detection** → **Policy Selection** → **Configuration Application**
3. **Debug Target Launch** → **Protocol Handshake** → **Session Coordination**

### Infrastructure Support
- **Container Awareness**: Path resolution, environment detection, and service configuration
- **Resource Management**: Process cleanup, connection pooling, and timeout handling
- **Observability**: Structured logging, error tracking, and diagnostic information

## Testing Patterns and Conventions

### Mock Infrastructure
- **Comprehensive Mocking**: All external dependencies (file system, network, processes) isolated through mocking
- **Type-Safe Factories**: Standardized mock creation with interface validation (`test-utils/`)
- **State Management**: Proper setup/teardown ensuring test isolation and resource cleanup

### Coverage Strategy
- **Happy Path Validation**: Core functionality works as expected
- **Error Scenario Testing**: Comprehensive edge case and failure mode coverage
- **Integration Boundaries**: Service interaction and communication protocol validation
- **Performance Considerations**: Timeout handling, caching behavior, and resource optimization

### Test Organization
- **Component Isolation**: Each module tested independently with mocked dependencies
- **Integration Points**: Key interfaces validated for proper coordination
- **Environment Awareness**: Container vs host behavior differences tested
- **Async Operations**: Proper Promise-based testing with timeout management

This test directory ensures the MCP debug server provides reliable multi-language debugging capabilities with robust error handling, proper resource management, and consistent behavior across different deployment scenarios and debugging targets.