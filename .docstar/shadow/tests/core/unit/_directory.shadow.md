# tests/core/unit/
@generated: 2026-02-10T01:20:02Z

## Overall Purpose

The `tests/core/unit` directory provides comprehensive unit test coverage for the DebugMCP system's core components. This directory validates the entire debugging infrastructure from low-level adapter interfaces through high-level server operations, ensuring reliability, type safety, and protocol compliance across the debug session lifecycle.

## Key Components and Integration

### Test Architecture Layers
- **Adapter Interface Layer** (`adapters/`): Validates the foundational contracts between DebugMCP and language-specific debug adapters, including state management, error categorization, and capability discovery
- **Factory Pattern Layer** (`factories/`): Tests dependency injection and instance creation patterns for proxy managers and session stores, with comprehensive mock utilities
- **Server Layer** (`server/`): Complete validation of the MCP debug server, testing all 14 debugging tools, session management, and protocol compliance
- **Session Management Layer** (`session/`): Extensive testing of the SessionManager orchestrator, covering state machines, DAP operations, multi-session coordination, and error recovery
- **Utility Layer** (`utils/`): Type safety validation and API migration testing for critical system boundaries

### Component Integration Flow
```
Adapter Interfaces → Factory Creation → Server Tool Registration → Session Management → Utility Validation
       ↓                    ↓                     ↓                      ↓                   ↓
   Type contracts    Instance creation    MCP protocol tools    DAP orchestration    Data validation
```

## Public API Surface

### Core Testing Entry Points
- **Debug Adapter Validation**: Tests for 40+ interface properties, 3 critical enums (AdapterState, AdapterErrorCode, DebugFeature), and error handling contracts
- **MCP Server Tools**: Complete coverage of debugging tool interface including session management (`create_debug_session`, `list_debug_sessions`), execution control (`start_debugging`, breakpoint operations, step debugging), and runtime inspection (`get_variables`, `get_stack_trace`, `get_scopes`)
- **Session Lifecycle**: End-to-end testing of session states (CREATED → INITIALIZING → PAUSED/RUNNING → STOPPED/ERROR) with error recovery and multi-session support
- **Type Safety Boundaries**: Runtime validation for AdapterCommand, ProxyInitPayload, and serialization safety

### Testing Infrastructure
- **Centralized Mock Factories**: Consistent dependency injection across all test suites
- **Cross-Platform Validation**: Windows/Unix path handling and platform-specific behavior
- **Integration Test Patterns**: Component interaction testing while maintaining unit test isolation
- **Performance and Memory**: Resource cleanup validation and scalability testing

## Internal Organization and Data Flow

### Test Execution Flow
1. **Interface Validation**: Adapter contracts and type safety at system boundaries
2. **Factory Creation**: Dependency injection and instance isolation testing
3. **Server Registration**: MCP tool registration and protocol compliance
4. **Session Orchestration**: DAP workflow management and state machine validation
5. **Utility Functions**: Migration safety and runtime type checking

### Key Testing Patterns
- **Mock Strategy**: Vitest-based comprehensive mocking with state tracking capabilities
- **State-Based Testing**: Validation of state transitions and lifecycle management
- **Error Boundary Testing**: Systematic coverage of failure scenarios and recovery paths
- **Concurrent Operations**: Multi-session testing with proper resource isolation
- **Protocol Compliance**: MCP and DAP protocol structure validation

## Important Conventions

### Quality Assurance Patterns
- **Comprehensive Coverage**: Each component includes positive/negative cases, edge conditions, and integration scenarios
- **Fake Timer Control**: Deterministic async testing for race conditions and timeout handling
- **Memory Management**: Event listener cleanup and leak prevention validation
- **Cross-Platform Support**: Consistent behavior across different operating systems
- **API Evolution**: Migration testing ensures backward compatibility and type safety

### Test Organization Standards
- Consistent describe/it structure across all test suites
- Centralized mock utilities preventing test pollution
- Standardized beforeEach/afterEach lifecycle management
- Integration-style testing maintaining unit test isolation principles

This comprehensive test suite serves as both validation and living documentation of the DebugMCP system's architecture, ensuring reliability and maintainability across the entire debugging infrastructure while providing confidence in protocol compliance and multi-language debug adapter support.