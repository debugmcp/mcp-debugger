# tests/unit/
@generated: 2026-02-11T23:48:19Z

## Overall Purpose

The `tests/unit` directory contains a comprehensive unit test suite for the MCP (Model Context Protocol) Debug Server, providing complete test coverage across all system components. This test infrastructure validates the core functionality that enables VS Code-like debugging experiences for multiple programming languages (Python, JavaScript, Rust) through the Debug Adapter Protocol (DAP).

## Key Components and System Integration

The test suite is organized around the major architectural layers of the MCP debug system:

### Core Server and Entry Points
- **`index.test.ts`**: Tests the main CLI entry point with server factory, command handling, and module exports
- **`server-coverage.test.ts`**: Comprehensive error path testing for `DebugMcpServer` edge cases and failure scenarios
- **`session-manager-operations-coverage.test.ts`**: Tests session lifecycle management, proxy operations, and debugging protocol coordination

### Debug Adapter System
- **`adapters/`**: Tests the pluggable adapter architecture for language-specific debugging (JavaScript, Python, Mock adapters)
- **`adapter-python/`**: Specialized tests for Python debugging with debugpy integration and environment validation
- Language-agnostic adapter loading, registry management, and lifecycle coordination

### Debug Protocol Infrastructure
- **`proxy/`**: Tests DAP proxy subsystem that bridges MCP clients with debug adapters, including connection management, message parsing, and process lifecycle
- **`dap-core/`**: Tests core DAP message handling and immutable state management for debug sessions
- **`shared/`**: Tests adapter policy system that provides language-specific debugging behaviors

### System Implementation Layer
- **`implementations/`**: Tests platform abstraction layer including filesystem, process management, network services, and environment handling
- **`container/`**: Tests dependency injection container that wires together all system services
- **`cli/`**: Tests command-line interface with STDIO/SSE transport modes and error handling

### Infrastructure and Utilities
- **`utils/`**: Tests core utilities for path resolution, error handling, logging, and container environment management
- **`test-utils/`**: Provides comprehensive mock generation and validation infrastructure used across all test suites

## Public API Surface and Entry Points

### Primary Server Interface
- **`createDebugMcpServer(options)`**: Main server factory for creating MCP debug server instances
- **`main()`**: CLI entry point with argument parsing and server initialization
- **STDIO/SSE Transport Handlers**: Command handlers for different communication modes

### Debug Session Management
- **`DebugMcpServer`**: Core server class managing debug sessions, adapters, and MCP protocol handling
- **`SessionManager`**: Orchestrates debug session lifecycle with proxy management and adapter coordination
- **`AdapterRegistry`**: Manages language adapter loading, registration, and instance lifecycle

### Debug Protocol Integration  
- **`ProxyManager`**: Manages DAP proxy processes and bidirectional communication
- **`AdapterPolicy` Interface**: Pluggable language-specific debugging behavior implementations
- **DAP Message Processing**: Handles Debug Adapter Protocol communication and state management

## Internal Organization and Data Flow

### Testing Architecture
The test suite follows consistent patterns across all components:
1. **Comprehensive Mocking**: Extensive use of Vitest mocking with dependency injection for isolation
2. **Error Path Coverage**: Systematic testing of failure scenarios, timeouts, and edge cases  
3. **State Management Testing**: Validation of immutable state transitions and lifecycle management
4. **Integration Testing**: End-to-end workflows with mocked external dependencies

### Component Interaction Flow
1. **CLI Layer**: Command parsing → option validation → server factory invocation
2. **Server Layer**: MCP protocol handling → session management → adapter coordination  
3. **Debug Layer**: Adapter selection → proxy startup → DAP communication → session lifecycle
4. **Infrastructure Layer**: Process management → file operations → network communication → logging

## Important Patterns and Conventions

### Mock and Test Infrastructure
- **Auto-Mock System**: Type-safe mock generation with interface validation (`test-utils/`)
- **Factory Pattern**: Standardized mock factories for consistent test setup across suites
- **Environment Isolation**: Comprehensive setup/teardown with environment variable management
- **Fake Timers**: Deterministic timeout and retry logic testing

### Error Handling and Resilience
- **Graceful Degradation**: Tests validate fallback behaviors and error recovery
- **Resource Cleanup**: Systematic testing of process cleanup, connection teardown, and memory management
- **Container Awareness**: Dual-mode testing for host vs containerized deployment scenarios

### Protocol Compliance
- **DAP Standard**: Comprehensive testing of Debug Adapter Protocol message handling
- **MCP Integration**: Validation of Model Context Protocol transport and session management
- **Language Agnostic**: Adapter pattern testing ensures consistent debugging across all supported languages

This test suite ensures the MCP Debug Server can reliably provide VS Code-quality debugging experiences across multiple programming languages while maintaining robust error handling, proper resource management, and protocol compliance in both development and production environments.