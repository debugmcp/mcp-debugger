# tests/core/unit/
@generated: 2026-02-10T21:27:00Z

## Overall Purpose and Responsibility

The `tests/core/unit` directory provides comprehensive unit test coverage for the core debugging infrastructure of the DebugMCP system. This test suite validates the foundational components that enable AI-driven debugging through the Model Context Protocol (MCP), ensuring type safety, proper session management, debugging protocol compliance, and system reliability across multiple programming languages.

## Key Components and Architecture

### Debug Adapter Interface Foundation (`adapters/`)
- **Type System Validation**: Comprehensive testing of 40+ interfaces including `AdapterConfig`, `AdapterCapabilities`, and language-specific launch configurations
- **Protocol Compliance**: Validates Debug Adapter Protocol (DAP) enum completeness across adapter states, error codes, and debug features
- **Error Handling Framework**: Tests custom error classes and recovery patterns for robust debugging operations

### Factory Pattern Infrastructure (`factories/`)
- **Dependency Injection Testing**: Validates `ProxyManagerFactory` and `SessionStoreFactory` for clean component creation
- **Mock Testing Framework**: Provides comprehensive mock implementations with state tracking and call history for test introspection
- **Instance Management**: Ensures proper isolation and stateless factory behavior across multiple debug sessions

### MCP Server Implementation (`server/`)
- **Protocol Integration**: Tests the complete MCP server implementation with 14 debugging tools covering session management, execution control, and runtime inspection
- **Tool Handler Validation**: Comprehensive testing of MCP request handlers for create/list/close sessions, breakpoint management, stepping operations, and variable inspection
- **Language Discovery**: Dynamic adapter detection and metadata generation for multi-language debugging support
- **Cross-Platform Support**: Container-aware discovery with graceful fallback mechanisms

### Session Management Core (`session/`)
- **Lifecycle Management**: Tests complete session state machine from creation through termination with proper cleanup
- **DAP Operations**: Validates Debug Adapter Protocol integration including breakpoints, stepping, variables, and stack traces
- **Multi-Session Coordination**: Ensures concurrent debugging sessions maintain proper isolation and resource management
- **Memory Safety**: Comprehensive event listener cleanup validation to prevent memory leaks
- **Error Recovery**: Robust testing of proxy crash recovery, timeout handling, and graceful failure modes

### System Utilities (`utils/`)
- **API Evolution**: Session parameter migration testing ensuring smooth deprecation of legacy APIs (`pythonPath` → `executablePath`)
- **Runtime Type Safety**: Comprehensive type guards for critical data boundaries including command validation and payload serialization
- **Cross-Platform Compatibility**: Platform-specific executable resolution and path handling validation

## Public API Surface and Entry Points

### Primary System Interfaces
- **DebugMcpServer**: Main MCP server class with complete debugging tool suite (14 tools)
- **SessionManager**: Core session lifecycle management with DAP operation support
- **Factory Classes**: `ProxyManagerFactory`, `SessionStoreFactory` for component instantiation
- **Type Guards**: Runtime validation functions for `AdapterCommand`, `ProxyInitPayload`, and related structures

### Testing Infrastructure
- **Mock Factories**: Comprehensive dependency injection containers for isolated testing
- **Test Utilities**: Shared helpers for cross-platform path handling, mock creation, and async testing patterns
- **Validation Framework**: Type safety, serialization integrity, and error handling verification

## Internal Organization and Data Flow

### Test Execution Architecture
1. **Dependency Setup**: Mock creation through centralized factory functions with consistent interface implementations
2. **Component Testing**: Isolated validation of individual classes and functions with comprehensive error path coverage
3. **Integration Validation**: End-to-end workflow testing ensuring proper component interaction
4. **Resource Cleanup**: Systematic teardown with memory leak prevention and state isolation

### Quality Assurance Patterns
- **Fake Timer Management**: Consistent async behavior testing using Vitest fake timers
- **Mock Strategy**: Complete external dependency mocking (file system, network, adapters) for test isolation
- **Error Scenario Coverage**: Systematic testing of failure modes, edge cases, and recovery mechanisms
- **Cross-Platform Testing**: Windows/Unix compatibility validation across path handling and executable resolution

### Testing Methodology
- **Type Safety First**: TypeScript compilation verification combined with runtime type guard testing
- **Memory Safety**: Event listener accumulation prevention and proper cleanup validation
- **Protocol Compliance**: DAP specification adherence testing across all debugging operations
- **Performance Validation**: Large dataset handling and scalability testing for production environments

## System Integration Points

The unit test suite validates the complete debugging infrastructure stack:
- **MCP Protocol Layer**: Server implementation with tool registration and request handling
- **Session Management Layer**: Multi-language debugging session lifecycle and coordination
- **Adapter Integration Layer**: Debug protocol compliance and language-specific adapter support
- **Utility Layer**: Type safety, API migration, and cross-platform compatibility

This comprehensive test coverage ensures the DebugMCP system provides reliable, type-safe, and performant debugging capabilities for AI agents across multiple programming languages and development environments.