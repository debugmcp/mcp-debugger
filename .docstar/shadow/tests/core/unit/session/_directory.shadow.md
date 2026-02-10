# tests/core/unit/session/
@generated: 2026-02-10T01:19:39Z

## Overall Purpose
This directory contains comprehensive unit tests for the **SessionManager** class, the core orchestrator of debugging sessions in the debug MCP system. The tests validate session lifecycle management, DAP (Debug Adapter Protocol) operations, state machine integrity, error handling, and multi-session coordination across different scenarios and edge cases.

## Key Components & Organization

### Core Functionality Tests
- **session-manager-workflow.test.ts**: End-to-end integration tests for complete debugging workflows
- **session-manager-integration.test.ts**: Cross-component integration testing with event handling and persistence
- **session-manager-state.test.ts**: State machine validation ensuring proper transitions (CREATED → INITIALIZING → PAUSED/RUNNING → STOPPED/ERROR)

### DAP Operations & Protocol Testing  
- **session-manager-dap.test.ts**: Debug Adapter Protocol operations including breakpoints, stepping, variable inspection, and stack traces
- **session-manager-paths.test.ts**: Path resolution and normalization across different operating systems

### Error Handling & Edge Cases
- **session-manager-error-recovery.test.ts**: Proxy crash recovery and timeout handling scenarios  
- **session-manager-edge-cases.test.ts**: Boundary conditions, failure modes, and graceful degradation
- **session-manager-dry-run.test.ts**: Race condition handling in dry run operations with precise timing control

### Resource Management & Scalability
- **session-manager-multi-session.test.ts**: Concurrent session management with proper isolation
- **session-manager-memory-leak.test.ts**: Event listener cleanup and memory leak prevention

### Supporting Infrastructure
- **session-manager-test-utils.ts**: Centralized mock factory providing consistent test dependencies
- **models.test.ts**: State model validation and legacy compatibility testing

## Public API Surface Tested
The tests validate SessionManager's primary interface methods:
- **Session Lifecycle**: `createSession()`, `startDebugging()`, `closeSession()`, `closeAllSessions()`
- **DAP Operations**: `setBreakpoint()`, `stepOver()`, `stepInto()`, `stepOut()`, `continue()`
- **Inspection**: `getVariables()`, `getStackTrace()`, `getScopes()`
- **State Management**: Session state transitions and error handling

## Internal Organization & Data Flow
Tests reveal SessionManager's architecture:
- **Two-tier state model**: High-level lifecycle states (CREATED, ACTIVE, TERMINATED) with detailed execution states (INITIALIZING, RUNNING, PAUSED, ERROR)
- **Event-driven coordination**: ProxyManager event propagation drives state transitions
- **Dependency injection**: Clean separation via SessionManagerDependencies interface
- **Session persistence**: Integration with SessionStore for state tracking
- **Resource cleanup**: Proper event listener management and proxy lifecycle handling

## Key Testing Patterns & Conventions
- **Fake timer control**: Deterministic async testing using Vitest's timer mocking
- **Mock dependency injection**: Consistent use of `createMockDependencies()` for isolation
- **State-based assertions**: Validation of session state at each lifecycle step  
- **Error simulation**: Strategic mocking to test failure scenarios
- **Concurrent operation testing**: Multi-session scenarios with proper isolation
- **Memory management**: Event listener cleanup verification to prevent leaks

## Critical Quality Attributes Validated
- **Reliability**: Comprehensive error handling and recovery scenarios
- **Scalability**: Multi-session management with resource isolation  
- **Maintainability**: Legacy state model compatibility and migration support
- **Performance**: Memory leak prevention and efficient resource cleanup
- **Robustness**: Race condition handling and timing-sensitive operations