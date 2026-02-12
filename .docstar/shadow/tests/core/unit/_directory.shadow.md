# tests\core\unit/
@generated: 2026-02-12T21:01:23Z

## Purpose and Responsibility

The `tests/core/unit` directory serves as the comprehensive unit testing hub for the DebugMCP system's core functionality. This testing module validates all critical components of the debug server architecture including adapter interfaces, factory patterns, session management, server operations, and utility functions. The tests ensure type safety, proper error handling, API compatibility, and robust debugging capabilities across multiple programming languages and platforms.

## Key Components and Architecture

### Testing Organization
The directory is organized into five specialized testing domains:

- **adapters/**: Validates foundational adapter interface contracts, enums, error handling, and type definitions
- **factories/**: Tests factory pattern implementations for proxy managers and session stores with comprehensive mock utilities
- **server/**: Comprehensive test suite for the MCP debugging server including tool handlers and protocol compliance
- **session/**: Core session orchestration testing covering lifecycle management, DAP operations, and multi-session coordination
- **utils/**: Utility function testing focusing on session migration, type guards, and runtime validation

### Integrated Testing Strategy
The test suites work together to validate the complete debugging ecosystem:

1. **Foundation Layer** (adapters): Ensures consistent type definitions and error handling patterns
2. **Factory Layer** (factories): Validates dependency injection and component creation
3. **Service Layer** (server): Tests MCP protocol compliance and tool handler implementations
4. **Core Logic Layer** (session): Validates debugging session orchestration and DAP operations
5. **Utility Layer** (utils): Ensures data integrity and API evolution support

## Public API Surface

### Primary Test Coverage Areas
- **14 MCP debugging tools**: Session management, execution control, and runtime inspection
- **Session lifecycle operations**: Create, initialize, pause, resume, terminate debugging sessions
- **Debug Adapter Protocol (DAP)**: Breakpoints, stepping, variable inspection, stack traces
- **Multi-language support**: Python, Node.js, and extensible adapter architecture
- **Error handling patterns**: Systematic error categorization and recovery mechanisms

### Key Validated Interfaces
- `DebugMcpServer`: Main MCP server with tool registration and lifecycle management
- `SessionManager`: Core session orchestration with state machine validation
- `ProxyManagerFactory` & `SessionStoreFactory`: Component creation with dependency injection
- `AdapterError`, `AdapterConfig`, `AdapterCapabilities`: Foundational adapter contracts
- Type guards and migration utilities for API evolution and data validation

## Internal Organization and Data Flow

### Testing Architecture
The test suites employ a layered approach with consistent patterns:

1. **Mock Infrastructure**: Comprehensive mock factories providing test doubles for all dependencies
2. **State Validation**: Systematic testing of state transitions and lifecycle management
3. **Error Injection**: Strategic failure simulation for testing recovery mechanisms  
4. **Integration Testing**: End-to-end workflow validation across component boundaries
5. **Edge Case Coverage**: Comprehensive boundary condition and error scenario testing

### Cross-Component Integration
- **Dependency Flow**: Factory tests → Session tests → Server tests ensure proper component wiring
- **Protocol Compliance**: Adapter interface validation feeds into session DAP operations and server tool handlers
- **Error Propagation**: Consistent error handling patterns tested from utility level through server responses
- **Mock Strategy**: Shared mock utilities enable consistent testing across all component layers

## Important Patterns and Conventions

### Testing Standards
- **Vitest framework**: Consistent testing infrastructure with comprehensive mocking capabilities
- **Fake timer control**: Deterministic async behavior testing across all time-dependent operations
- **Mock isolation**: Complete dependency mocking prevents external system interactions during testing
- **State machine validation**: Systematic testing of all state transitions and edge cases

### Quality Assurance Features
- **Memory leak prevention**: Event listener cleanup verification and resource management testing
- **Concurrent session support**: Multi-session isolation and race condition testing
- **Platform compatibility**: Cross-platform path handling and environment detection
- **API evolution support**: Migration testing ensuring backward compatibility breaks are intentional
- **Type safety enforcement**: Runtime type validation and compile-time type checking

### Error Handling Standardization
- **Systematic categorization**: Environment, connection, protocol, and runtime error domains
- **Recovery mechanisms**: Graceful degradation and automatic recovery testing
- **MCP compliance**: Proper error response formatting for Model Context Protocol
- **Logging consistency**: Structured error reporting and debugging information capture

This comprehensive unit testing directory ensures the DebugMCP system maintains high reliability, proper error handling, and consistent behavior across all debugging scenarios while supporting multiple programming languages and development environments.