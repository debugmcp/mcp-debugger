# tests\core/
@generated: 2026-02-12T21:01:38Z

## Purpose and Responsibility

The `tests/core` directory serves as the comprehensive testing foundation for the DebugMCP system's core functionality. This directory ensures the reliability, correctness, and robustness of all critical debugging infrastructure components through systematic unit testing of adapter interfaces, factory patterns, session management, server operations, and utility functions.

## Key Components and Architecture

### Testing Organization
The directory contains specialized testing domains organized in the `unit/` subdirectory:

- **adapters/**: Validates foundational adapter interface contracts, type definitions, and error handling patterns
- **factories/**: Tests dependency injection and component creation through factory pattern implementations
- **server/**: Comprehensive MCP debugging server testing including tool handlers and protocol compliance
- **session/**: Core session orchestration testing covering lifecycle management and Debug Adapter Protocol (DAP) operations
- **utils/**: Utility function testing for session migration, type guards, and runtime validation

### Integrated Testing Strategy
The test components work together in a layered validation approach:

1. **Foundation Validation**: Adapter interface contracts ensure consistent type definitions and error handling
2. **Component Creation**: Factory pattern testing validates proper dependency injection and initialization
3. **Protocol Compliance**: Server testing ensures MCP protocol adherence and tool handler functionality
4. **Core Logic Validation**: Session management testing covers debugging lifecycle and DAP operations
5. **Utility Support**: Helper function testing ensures data integrity and API evolution compatibility

## Public API Surface

### Primary Test Coverage
- **MCP Debugging Tools**: Complete validation of 14 debugging tools for session management and runtime inspection
- **Session Lifecycle**: Create, initialize, pause, resume, and terminate operations across multiple debugging sessions
- **Debug Adapter Protocol**: Comprehensive DAP compliance including breakpoints, stepping, variable inspection, and stack traces
- **Multi-Language Support**: Python, Node.js, and extensible adapter architecture validation
- **Error Handling**: Systematic testing of error categorization, propagation, and recovery mechanisms

### Key Tested Interfaces
- `DebugMcpServer`: Main MCP server with tool registration and lifecycle management
- `SessionManager`: Core session orchestration with state machine validation
- Factory classes for proxy managers and session stores with dependency injection
- Adapter foundational contracts including error types, configurations, and capabilities
- Type safety utilities and migration functions for API evolution

## Internal Organization and Data Flow

### Testing Architecture
The directory employs consistent testing patterns across all components:

- **Mock Infrastructure**: Comprehensive test doubles for all external dependencies
- **State Validation**: Systematic testing of state transitions and lifecycle management
- **Error Injection**: Strategic failure simulation to validate recovery mechanisms
- **Integration Testing**: End-to-end workflow validation across component boundaries
- **Edge Case Coverage**: Boundary conditions and error scenario testing

### Cross-Component Integration
The testing strategy ensures proper component interaction through:

- **Layered Validation**: Factory → Session → Server test progression validates proper component wiring
- **Protocol Consistency**: Adapter interface validation feeds into session DAP operations and server responses
- **Error Flow Testing**: Consistent error handling validation from utility level through server tool responses
- **Shared Mock Strategy**: Common mock utilities enable consistent testing patterns across all layers

## Important Patterns and Conventions

### Testing Standards
- **Vitest Framework**: Consistent testing infrastructure with comprehensive mocking and assertion capabilities
- **Deterministic Testing**: Fake timer control for reliable async behavior validation
- **Dependency Isolation**: Complete mocking prevents external system interactions during test execution
- **State Machine Validation**: Comprehensive testing of all possible state transitions and edge cases

### Quality Assurance Features
- **Resource Management**: Memory leak prevention through event listener cleanup verification
- **Concurrency Testing**: Multi-session isolation and race condition validation
- **Platform Compatibility**: Cross-platform behavior validation and environment detection
- **API Evolution Support**: Migration testing ensures controlled backward compatibility management
- **Type Safety**: Runtime validation and compile-time type checking enforcement

This comprehensive core testing directory ensures the DebugMCP system maintains high reliability, proper error handling, and consistent behavior across all debugging scenarios while supporting multiple programming languages and development environments through systematic validation of all critical system components.