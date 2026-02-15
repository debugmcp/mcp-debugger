# tests\core/
@children-hash: a6c0f5d66e415433
@generated: 2026-02-15T09:02:06Z

## Overall Purpose

The `tests/core` directory provides comprehensive test coverage for the entire debugMCP core system, validating all components that enable AI agents to perform debugging operations through the Model Context Protocol (MCP). This directory ensures the reliability, type safety, and proper integration of debug adapter protocols, session management, server implementations, and utility functions.

## Key Components Integration

### Testing Architecture
The directory currently contains the `unit/` subdirectory which provides foundational unit test coverage across five major test modules that mirror the core system architecture:

- **Protocol Foundation**: Tests debug adapter protocol contracts and interface definitions
- **Factory Patterns**: Validates dependency injection and instance creation for proxy managers and session stores
- **MCP Server Implementation**: Tests the server that exposes debugging capabilities through MCP protocol tools
- **Session Management**: Comprehensive testing of session lifecycle and Debug Adapter Protocol (DAP) operations
- **Utility Functions**: Tests type safety, API migration support, and data validation

### System Integration Flow
The test components validate the complete debugging workflow integration:

1. **Protocol Contracts**: Ensures type-safe communication interfaces between components
2. **Dependency Creation**: Validates factory patterns for creating required system instances
3. **MCP Tool Exposure**: Verifies debugging operations are properly exposed to AI agents through protocol tools
4. **Session Orchestration**: Tests the core SessionManager that coordinates all debugging operations
5. **Runtime Safety**: Validates type guards and data validation that protect system boundaries

## Public API Coverage

### MCP Protocol Tools (Primary Interface for AI Agents)
The tests validate 14+ MCP tools that form the public debugging API:

**Session Lifecycle**
- `create_debug_session`: Initialize debugging with language detection
- `list_debug_sessions`: Enumerate active sessions
- `close_debug_session`: Clean up resources

**Debug Control Operations**
- `set_breakpoint`: Breakpoint management with conditional support
- `start_debugging`: Begin script execution in debug mode
- `step_over/step_into/step_out`: Execution stepping controls
- `continue_execution/pause_execution`: Flow control operations

**Code Inspection Tools**
- `get_variables`: Variable value inspection
- `get_stack_trace`: Execution stack information
- `get_scopes`: Debug scope and context access
- `evaluate_expression`: Expression execution in debug context
- `get_source_context`: Source code context retrieval

### Core System Interfaces
- Factory interfaces for creating proxy managers and session stores with language support
- SessionManager API for lifecycle operations and DAP protocol handling
- Multi-session concurrency with proper state isolation

## Internal Organization

### Quality Assurance Strategy
- **Comprehensive Coverage**: All core components tested from protocol contracts through session management
- **Centralized Testing Infrastructure**: Shared mock factories and consistent testing patterns using Vitest framework
- **Error Scenario Validation**: Extensive error handling and graceful degradation testing
- **Concurrency Safety**: Multi-session scenarios and race condition handling
- **Resource Management**: Memory leak prevention and proper cleanup validation
- **Platform Compatibility**: Cross-platform support validation

### Testing Conventions
- Environment isolation with proper lifecycle management
- Systematic mocking for component isolation and dependency injection
- Contract validation ensuring interface and protocol compliance
- State machine validation for proper lifecycle transitions
- Performance testing for high-throughput operations like type guards

This directory ensures the debugMCP core system provides reliable, type-safe debugging capabilities through the MCP protocol, with comprehensive validation of the complete system from foundational protocols through the public API surface that AI agents interact with.