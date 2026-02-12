# tests\unit/
@generated: 2026-02-12T21:06:26Z

## Overall Purpose

The `tests/unit` directory contains comprehensive unit test suites for the entire Debug MCP Server system, providing complete validation coverage for a multi-language debugging platform that enables debugging of various programming languages (Python, JavaScript, Rust) through the Debug Adapter Protocol (DAP) and Model Context Protocol (MCP). The test suite ensures reliability, error handling, and proper integration across all system components.

## Architecture and Component Integration

### Core System Architecture
The tests validate a layered architecture where:
- **Entry Point** (`index.test.ts`): CLI initialization and server factory creation
- **Server Layer** (`server-coverage.test.ts`): Main DebugMcpServer orchestrating debugging sessions
- **Session Management** (`session-manager-operations-coverage.test.ts`): Abstract session operations with language-specific implementations
- **Proxy Layer** (`proxy/`): DAP proxy system managing communication between clients and debug adapters
- **Adapters** (`adapters/`, `adapter-python/`): Language-specific debug adapter implementations
- **Infrastructure** (`implementations/`, `container/`, `utils/`): Core services and utilities

### Integration Flow Validation
Tests ensure proper data flow through the system:
1. **CLI Commands** → **Server Factory** → **DebugMcpServer** instance creation
2. **Debug Requests** → **Session Manager** → **Language Adapters** → **Proxy Processes**
3. **DAP Communication** → **Message Routing** → **Client/Adapter Protocol Handling**
4. **Error Scenarios** → **Graceful Degradation** → **User-Friendly Error Messages**

## Key Test Categories and Coverage

### Infrastructure Testing
- **Dependency Injection** (`container/`): Service wiring and adapter registration
- **Implementation Layer** (`implementations/`): File system, network, process management, environment handling
- **Utilities** (`utils/`): Path resolution, logging, error formatting, file operations
- **Mock Infrastructure** (`test-utils/`): Automated mock generation and test utilities

### Core Functionality Testing
- **Session Management**: Debug session lifecycle, state management, breakpoint handling
- **Proxy System**: DAP protocol communication, message routing, connection management
- **Language Adapters**: Python/JavaScript-specific debugging, feature support, configuration
- **CLI Interface**: Command processing, transport modes (STDIO/SSE), error handling

### Integration and Edge Case Testing
- **Container Support**: Host/container dual-mode operation with path resolution
- **Error Resilience**: Network failures, timeout scenarios, malformed inputs
- **Concurrency**: Multiple simultaneous debug sessions and race conditions
- **Resource Management**: Process cleanup, connection handling, memory management

## Public API Validation

### Primary Entry Points Tested
- **`createDebugMcpServer(options)`**: Main server factory function
- **`main()`**: CLI application entry point with transport selection
- **Command Handlers**: STDIO and SSE transport mode handling
- **Adapter Registry**: Dynamic adapter loading and language support detection

### Core Service Interfaces
- **DebugMcpServer**: Session creation, debugging operations, lifecycle management
- **SessionManager**: Abstract session operations (start, stop, step, breakpoints)
- **AdapterRegistry**: Language adapter discovery and instantiation
- **ProxyManager**: DAP proxy process management and communication

### Utility APIs
- **Container Utilities**: Path resolution, environment detection
- **Error Handling**: Standardized error message generation
- **File Operations**: Safe file system access with caching
- **Logging**: Configurable winston-based logging system

## Testing Strategy and Patterns

### Mock Architecture
- **Comprehensive Mocking**: All external dependencies mocked for isolated testing
- **Auto-Mock Generation**: Type-safe mock creation with interface validation
- **Event Simulation**: EventEmitter patterns for process and network communication
- **Fake Timers**: Deterministic async behavior testing

### Error Path Coverage
- **Failure Scenarios**: Network timeouts, process failures, invalid configurations
- **Edge Cases**: Race conditions, resource exhaustion, malformed protocol messages
- **Recovery Testing**: Graceful degradation and cleanup verification

### Integration Validation
- **Cross-Component Testing**: Validates component interactions and data flow
- **Protocol Compliance**: DAP and MCP protocol adherence
- **Multi-Language Support**: Consistent behavior across language adapters

## Critical System Behaviors Validated

### Debugging Workflow Reliability
- Debug session creation, configuration, and termination
- Breakpoint setting, variable inspection, and step operations
- Multi-threaded debugging with proper thread management
- Error propagation and user-friendly error messaging

### System Resilience
- Graceful handling of adapter failures and network issues
- Proper resource cleanup and process management
- Container/host environment compatibility
- Concurrent debugging session management

### Development Experience
- Comprehensive CLI with multiple transport modes
- Dynamic language adapter loading and configuration
- Robust error handling with actionable error messages
- Extensible architecture supporting new language adapters

This test suite ensures the Debug MCP Server provides a reliable, scalable debugging platform that can handle complex multi-language debugging scenarios while maintaining excellent error resilience and user experience across different deployment environments.