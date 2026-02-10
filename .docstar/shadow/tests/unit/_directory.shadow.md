# tests/unit/
@generated: 2026-02-09T18:16:49Z

## Overall Purpose and Responsibility

The `tests/unit` directory contains a comprehensive unit test suite for the debug-mcp-server system, providing test coverage for all core modules including CLI commands, debugging adapters, session management, DAP protocol handling, container infrastructure, and utility functions. This test suite ensures system reliability through isolated testing with extensive mocking, validating both happy-path scenarios and error conditions across the entire debugging infrastructure.

## Key Components and Architecture

### Core System Test Modules
- **Server & Sessions**: Complete coverage of `DebugMcpServer`, session lifecycle management, and debugging operations with timeout handling and state validation
- **CLI Interface**: Tests for all command handlers (STDIO, SSE), error management, version utilities, and Commander.js integration
- **Debug Adapters**: Comprehensive testing of language-specific adapters (Python, JavaScript), adapter registry, dynamic loading, and factory patterns
- **DAP Protocol**: Message handling, state management, connection management, and proxy process coordination
- **Container Support**: Dependency injection, path resolution, environment detection, and containerized execution testing

### Infrastructure and Utilities
- **Implementations Layer**: File system, process management, network operations, and environment abstractions with complete fs-extra and child_process mocking
- **Shared Components**: Adapter policies, filesystem abstractions, and cross-language debugging protocol implementations
- **Utilities**: Path resolution, error formatting, logging configuration, language filtering, and line-based content processing

## Public API Test Coverage

### Main Entry Points
- **Server Operations**: `createDebugMcpServer()`, session CRUD operations, debugging lifecycle management
- **CLI Commands**: `handleStdioCommand()`, `handleSSECommand()`, `handleCheckRustBinaryCommand()`
- **Adapter Management**: Dynamic adapter loading, registry operations, and language-specific debugging capabilities
- **Container Integration**: `createProductionDependencies()`, environment detection, and workspace path resolution

### Protocol and Communication
- **DAP Integration**: Message parsing, request tracking, connection management, and event propagation
- **Transport Layers**: STDIO transport for standard MCP communication and SSE transport for web-based debugging clients
- **Process Coordination**: Proxy manager lifecycle, handshake protocols, and orphan process detection

## Internal Organization and Data Flow

### Testing Architecture
- **Mock-First Strategy**: Comprehensive mocking of all external dependencies (file system, processes, network) for isolated unit testing
- **Dependency Injection**: Consistent factory pattern testing with validated mock creation and interface compatibility
- **Event-Driven Testing**: EventEmitter-based test doubles for asynchronous operation simulation and timing control

### Test Infrastructure Patterns
- **Fake Timer Management**: Deterministic async testing with controllable timeouts and retry logic
- **Environment Isolation**: Process.env backup/restore patterns with container mode simulation
- **Resource Cleanup**: Systematic beforeEach/afterEach hooks preventing test contamination
- **State Validation**: Immutable state management testing with comprehensive mutation prevention

### Integration Testing Flow
1. **Request Processing**: CLI command parsing → Server initialization → Session management → Debug adapter coordination
2. **Message Routing**: MCP commands → DAP protocol translation → Debug target communication → Response correlation
3. **Error Propagation**: Error detection → User-friendly message formatting → Graceful failure handling → Resource cleanup

## Important Patterns and Conventions

### Quality Assurance Standards
- **Zero Side Effects**: All system operations mocked to prevent actual file/network/process execution during testing
- **Interface Contracts**: Extensive validation ensuring mocks maintain compatibility with production interfaces
- **Error Boundary Testing**: Comprehensive coverage of failure scenarios, timeouts, and edge cases
- **Cross-Platform Support**: Container vs. non-container behavior validation with environment-specific path handling

### Development Support Features
- **Auto-Mock Generation**: Type-safe mock creation with interface validation through `test-utils/auto-mock.ts`
- **Factory Libraries**: Pre-configured mock factories for complex objects (sessions, adapters, processes)
- **Test Utilities**: Specialized test implementations (TestProxyManager) for deterministic debugging protocol testing
- **Coverage Targeting**: Dedicated coverage tests for branch completion and error path validation

### Container and Environment Awareness
- **Container Detection**: `MCP_CONTAINER` environment variable testing and path resolution adaptation
- **Language Configuration**: Environment-based language filtering with case-insensitive matching
- **Workspace Resolution**: Container-aware path manipulation with `/workspace/` prefixing and host path mapping

This comprehensive test suite serves as both validation infrastructure and living documentation, ensuring the debug-mcp-server system maintains reliability, performance, and proper error handling across all supported debugging scenarios and deployment environments.