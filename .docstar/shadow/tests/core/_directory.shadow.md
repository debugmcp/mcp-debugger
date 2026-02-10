# tests/core/
@generated: 2026-02-10T01:20:17Z

## Overall Purpose

The `tests/core` directory serves as the comprehensive validation layer for DebugMCP's core debugging infrastructure. This directory ensures the reliability, protocol compliance, and architectural integrity of the entire debugging system through extensive unit testing coverage spanning from low-level adapter interfaces to high-level server operations.

## Key Components and Integration

### Testing Architecture Overview
The directory is organized around a single comprehensive unit testing module (`unit/`) that validates the complete DebugMCP system through multiple interconnected layers:

- **Adapter Interface Validation**: Tests foundational contracts between DebugMCP and language-specific debug adapters, including state management, error categorization, and capability discovery
- **Factory Pattern Testing**: Validates dependency injection and instance creation patterns for proxy managers and session stores with comprehensive mock utilities  
- **Server Protocol Testing**: Complete validation of the MCP debug server with all 14 debugging tools, session management, and protocol compliance
- **Session Management Testing**: Extensive validation of the SessionManager orchestrator covering state machines, DAP operations, multi-session coordination, and error recovery
- **Utility Layer Testing**: Type safety validation and API migration testing for critical system boundaries

### Component Integration Flow
```
Unit Test Suite
    ↓
Adapter Interface Tests → Factory Tests → Server Tool Tests → Session Management Tests → Utility Tests
         ↓                    ↓               ↓                      ↓                    ↓
   Type contracts      Instance creation  MCP protocol      DAP orchestration    Data validation
```

## Public API Surface

### Core Testing Entry Points
- **Debug Adapter Validation Suite**: Tests 40+ interface properties, 3 critical enums (AdapterState, AdapterErrorCode, DebugFeature), and comprehensive error handling contracts
- **MCP Server Tool Testing**: Complete coverage of debugging tool interfaces including:
  - Session management (`create_debug_session`, `list_debug_sessions`)
  - Execution control (`start_debugging`, breakpoint operations, step debugging)
  - Runtime inspection (`get_variables`, `get_stack_trace`, `get_scopes`)
- **Session Lifecycle Testing**: End-to-end validation of session states (CREATED → INITIALIZING → PAUSED/RUNNING → STOPPED/ERROR) with error recovery and multi-session support
- **Type Safety Boundary Testing**: Runtime validation for AdapterCommand, ProxyInitPayload, and serialization safety

### Testing Infrastructure API
- **Centralized Mock Factories**: Consistent dependency injection patterns across all test suites
- **Cross-Platform Validation**: Windows/Unix path handling and platform-specific behavior testing
- **Integration Test Patterns**: Component interaction testing while maintaining unit test isolation
- **Performance and Resource Testing**: Memory cleanup validation and scalability testing

## Internal Organization and Data Flow

### Test Execution Architecture
The unit testing framework follows a structured validation flow:

1. **Interface Contract Validation**: Ensures adapter interfaces and type safety at system boundaries
2. **Factory Creation Testing**: Validates dependency injection and instance isolation patterns
3. **Server Protocol Testing**: Confirms MCP tool registration and protocol compliance
4. **Session Orchestration Testing**: Validates DAP workflow management and state machine transitions
5. **Utility Function Testing**: Ensures migration safety and runtime type checking

### Key Testing Patterns and Conventions
- **Mock Strategy**: Vitest-based comprehensive mocking with state tracking capabilities
- **State-Based Testing**: Systematic validation of state transitions and lifecycle management
- **Error Boundary Testing**: Complete coverage of failure scenarios and recovery paths
- **Concurrent Operations Testing**: Multi-session validation with proper resource isolation
- **Protocol Compliance Testing**: MCP and DAP protocol structure validation

## Quality Assurance Standards

The testing directory enforces critical quality patterns including comprehensive coverage with positive/negative cases and edge conditions, fake timer control for deterministic async testing, memory management validation for event listener cleanup, cross-platform consistency testing, and API evolution testing to ensure backward compatibility and type safety.

This testing infrastructure serves as both validation framework and living documentation of the DebugMCP system's architecture, providing confidence in protocol compliance and multi-language debug adapter support while ensuring system reliability and maintainability across the entire debugging infrastructure.