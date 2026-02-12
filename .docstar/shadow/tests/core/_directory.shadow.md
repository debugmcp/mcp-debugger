# tests\core/
@generated: 2026-02-12T21:06:29Z

## Core Testing Infrastructure

The `tests/core` directory provides comprehensive validation of the debugMCP system's foundational debugging infrastructure. This testing suite ensures the reliability, correctness, and integration of all core components that enable Model Context Protocol (MCP) debugging capabilities across multiple programming languages.

### Overall Purpose & Responsibility

This module serves as the primary quality assurance layer for the debugMCP system's core architecture. It validates the complete debugging infrastructure stack—from low-level adapter protocols to high-level session orchestration—ensuring that the system can reliably manage debugging sessions across different programming languages while maintaining protocol compliance and operational stability.

### Key Components & Integration

**Layered Validation Architecture**:
The testing infrastructure follows a hierarchical validation approach that mirrors the system's architecture:

1. **Protocol Foundation** (`unit/adapters/`): Validates Debug Adapter Protocol compliance, interface specifications, and the 7-state adapter lifecycle with 13 categorized error codes
2. **Component Creation** (`unit/factories/`): Tests factory pattern implementations for dependency injection and instance management
3. **Service Layer** (`unit/server/`, `unit/session/`): Validates core business logic, the 14-tool MCP debugging interface, and session orchestration
4. **Safety Layer** (`unit/utils/`): Ensures data integrity, type safety, and API migration compatibility

These layers work together to provide comprehensive coverage of the system's debugging capabilities, from individual component behavior to end-to-end workflow validation.

### Public API Surface

The test suite validates the complete debugMCP public interface:

**Core MCP Debugging Tools** (14 tools organized into three categories):
- **Session Management**: create_debug_session, list_debug_sessions, close_debug_session
- **Execution Control**: start_debugging, set_breakpoint, step_over/into/out, continue/pause_execution  
- **Runtime Inspection**: get_variables, get_stack_trace, get_scopes, evaluate_expression

**Component Factories**:
- ProxyManagerFactory and SessionStoreFactory with full dependency injection support
- Mock factory implementations for isolated testing scenarios

**Session Orchestration**:
- Complete SessionManager API for debugging workflow coordination
- Multi-session isolation and state machine management
- Cross-platform compatibility and language discovery

### Internal Organization & Data Flow

The testing architecture employs sophisticated validation strategies:

**Mock Infrastructure**: Centralized mock factories and fake timers enable deterministic testing of async operations, race conditions, and error scenarios while maintaining test isolation and repeatability.

**Integration Testing**: Rather than pure unit tests, the suite focuses on component interaction validation, ensuring that the Debug Adapter Protocol flows correctly through the system and that MCP tool orchestration works end-to-end.

**Error Resilience**: Comprehensive boundary testing and failure injection validate the system's error handling, recovery mechanisms, and graceful degradation capabilities.

### Important Patterns & Conventions

**Comprehensive Validation Strategy**:
- Protocol compliance testing ensures adherence to Debug Adapter Protocol and MCP specifications
- State machine integrity validation with proper transition testing
- Memory management and resource cleanup verification
- Cross-platform compatibility testing for Windows/Unix environments

**Testing Evolution Support**:
- API migration testing (e.g., `pythonPath` to `executablePath` transition)
- Backward compatibility validation
- Type guard benchmarking for runtime safety at IPC boundaries

### System Role

This testing infrastructure serves as the critical quality gate for the debugMCP system, ensuring that:
- All debugging operations maintain protocol compliance across language adapters
- Session management remains reliable under concurrent access and error conditions  
- The MCP interface provides consistent debugging capabilities regardless of target language
- System evolution and API changes don't break existing functionality

The `tests/core` directory collectively validates that the debugMCP system can serve as a reliable, protocol-compliant debugging bridge between MCP clients and language-specific debug adapters, maintaining operational stability and cross-platform compatibility throughout its debugging workflows.