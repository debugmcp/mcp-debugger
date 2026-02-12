# tests\core\unit\session/
@generated: 2026-02-12T21:05:52Z

## Purpose
Comprehensive unit and integration test suite for SessionManager component, the core debugging session orchestrator in the debugMCP system. Tests validate session lifecycle management, Debug Adapter Protocol (DAP) operations, state machine integrity, error handling, and memory management across various scenarios.

## Test Organization

### Core Functionality Tests
- **session-manager-workflow.test.ts**: End-to-end integration tests covering complete debugging workflows from session creation through breakpoint management and cleanup
- **session-manager-dap.test.ts**: DAP operation tests including breakpoint management, stepping operations (step over/into/out), variable inspection, and stack trace retrieval
- **session-manager-state.test.ts**: State machine integrity tests ensuring proper transitions between CREATED → INITIALIZING → PAUSED/RUNNING → STOPPED/ERROR states

### Edge Cases and Error Handling
- **session-manager-edge-cases.test.ts**: Boundary condition tests for error scenarios, invalid operations, and graceful degradation
- **session-manager-error-recovery.test.ts**: Proxy crash recovery, timeout handling, and resilience testing with controlled failure simulation
- **session-manager-paths.test.ts**: Cross-platform path resolution testing for Windows/Unix compatibility and breakpoint file handling

### Advanced Scenarios
- **session-manager-multi-session.test.ts**: Concurrent session management with proper isolation between multiple simultaneous debugging contexts
- **session-manager-integration.test.ts**: Cross-component integration testing with event handling, logging, and session persistence
- **session-manager-dry-run.test.ts**: Dry run execution mode with timing-sensitive race condition scenarios
- **session-manager-memory-leak.test.ts**: Memory management validation ensuring proper event listener cleanup and leak prevention

### Supporting Components
- **session-manager-test-utils.ts**: Centralized test utilities providing mock dependencies, SessionManagerDependencies factory, and mock environment setup
- **models.test.ts**: Session state model validation including backward compatibility testing for legacy state mappings and enum definitions

## Key Testing Patterns

### Mock Infrastructure
All tests use standardized mocking via `createMockDependencies()` utility providing:
- MockProxyManager for DAP communication simulation
- Mock file system, logger, and network manager
- Controlled timing via Vitest fake timers
- Consistent test isolation and dependency injection

### State Validation
Tests comprehensively validate SessionManager's state machine:
- Valid transitions: CREATED → INITIALIZING → PAUSED/RUNNING → STOPPED
- Invalid operation prevention (e.g., stepping when not paused)
- Error state handling with proper cleanup

### Timing Control
Extensive use of fake timers enables deterministic testing of:
- Async operations and event handling
- Timeout scenarios and race conditions
- Event listener lifecycle management

### Error Simulation
Strategic failure injection tests:
- Proxy crashes and recovery scenarios
- DAP request failures and timeout handling
- Resource cleanup during error conditions

## Public API Coverage

### Session Lifecycle
- `createSession()`: Session creation with language and executable configuration
- `startDebugging()`: Debug initialization with DAP launch arguments
- `closeSession()` / `closeAllSessions()`: Resource cleanup and termination

### Debug Operations  
- Breakpoint management: setting, verification, conditional breakpoints
- Step operations: `stepOver()`, `stepInto()`, `stepOut()` with timeout handling
- Execution control: `continue()`, pause detection, state transitions

### Inspection Operations
- `getVariables()`: Variable retrieval with scope fallback
- `getStackTrace()`: Stack frame inspection
- `getScopes()`: Scope enumeration for debugging context

### State Management
- Session state tracking and validation
- Event-driven state updates from proxy manager
- Error state handling and recovery

## Critical Test Scenarios

### Memory Management
Event listener cleanup prevention of memory leaks during session lifecycle operations, with validation of proper removeListener calls and listener count tracking.

### Concurrency
Multi-session isolation ensuring independent debugging contexts without state leakage or resource conflicts.

### Error Recovery
Robust handling of proxy failures, network timeouts, and unexpected termination with graceful degradation and proper cleanup.

### Backward Compatibility
Legacy session state mapping validation for system upgrades maintaining debugging session integrity during state model transitions.

This test suite ensures SessionManager's reliability as the central debugging orchestrator, validating both happy-path functionality and edge case resilience across the complete debugging workflow.