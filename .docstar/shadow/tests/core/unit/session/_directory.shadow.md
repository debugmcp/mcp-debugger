# tests/core/unit/session/
@generated: 2026-02-11T23:47:50Z

## Purpose
This directory contains comprehensive unit tests for the `SessionManager` class, which is the core component responsible for managing debugging sessions in the debugMCP system. The test suite validates session lifecycle management, Debug Adapter Protocol (DAP) operations, state machine integrity, and error recovery mechanisms.

## Test Architecture Overview

### Core Test Structure
The test suite follows a modular organization with shared test utilities and specialized test files covering different aspects of SessionManager functionality:

- **Shared Test Infrastructure**: `session-manager-test-utils.ts` provides centralized mock dependencies and setup patterns
- **Core Functionality Tests**: Multiple focused test files covering specific operational areas
- **Integration Tests**: End-to-end workflow validation and cross-component behavior testing

### Key Components and Test Coverage

#### Session Lifecycle Management
- **State Machine Integrity** (`session-manager-state.test.ts`): Validates proper state transitions (CREATED → INITIALIZING → PAUSED/RUNNING → STOPPED/ERROR)
- **Multi-Session Coordination** (`session-manager-multi-session.test.ts`): Tests concurrent session isolation and bulk operations
- **Integration Workflows** (`session-manager-integration.test.ts`, `session-manager-workflow.test.ts`): End-to-end debugging cycle validation

#### Debug Adapter Protocol (DAP) Operations
- **DAP Commands** (`session-manager-dap.test.ts`): Breakpoint management, stepping operations, variable/stack inspection
- **Error Recovery** (`session-manager-error-recovery.test.ts`): Proxy crash handling, timeout scenarios, cleanup verification
- **Edge Cases** (`session-manager-edge-cases.test.ts`): Boundary conditions, failure modes, graceful degradation

#### Session State Models
- **Dual-State Architecture** (`models.test.ts`): Tests backward compatibility between legacy SessionState enum and new {lifecycle, execution} dual-state model
- **State Mapping Functions**: Bidirectional conversion between legacy and modern state representations

#### Specialized Scenarios
- **Memory Leak Prevention** (`session-manager-memory-leak.test.ts`): Event listener cleanup and resource management
- **Path Resolution** (`session-manager-paths.test.ts`): Cross-platform path handling and normalization
- **Dry Run Operations** (`session-manager-dry-run.test.ts`): Race condition handling and timing-sensitive dry run scenarios

## Public API Surface (Test-Validated Operations)

### Session Management
- `createSession(language, executablePath?, sessionName?)`: Session creation with unique ID generation
- `startDebugging(sessionId, options)`: Debug session initialization with DAP configuration
- `closeSession(sessionId)`: Individual session cleanup with state transitions
- `closeAllSessions()`: Bulk session termination with proper resource cleanup

### DAP Operations
- **Breakpoint Management**: `setBreakpoint()` with queuing and verification
- **Execution Control**: `continue()`, `stepOver()`, `stepInto()`, `stepOut()`
- **Inspection Operations**: `getVariables()`, `getStackTrace()`, `getScopes()`
- **State Queries**: `getSession()`, session state monitoring

### Configuration & Environment
- Path resolution with cross-platform compatibility
- Dry run mode support with timing controls
- Custom executable path handling
- Environment variable integration

## Internal Organization and Data Flow

### Dependency Injection Pattern
All tests use `createMockDependencies()` for consistent dependency injection, providing:
- MockProxyManager for DAP communication simulation
- Mock file system, logging, and network services
- SessionStoreFactory for session persistence
- Mock environment and path utilities

### Event-Driven Architecture
SessionManager operates through ProxyManager event propagation:
- Debug events: 'stopped', 'continued', 'terminated', 'exited'
- Initialization events: 'initialized', 'adapter-configured', 'dry-run-complete'
- Error handling: 'error', 'exit' events with proper cleanup

### State Management Flow
1. **Session Creation**: CREATED state with unique ID generation
2. **Debug Initialization**: INITIALIZING state with proxy startup
3. **Active Debugging**: PAUSED/RUNNING states based on execution context
4. **Session Termination**: STOPPED/ERROR states with resource cleanup

## Test Patterns and Conventions

### Mock Configuration Standards
- Fake timers with `vi.useFakeTimers()` for deterministic async testing
- MockProxyManager with configurable failure modes (`shouldFailStart`, `simulateExit`)
- Consistent test configuration: `/tmp/test-sessions` log directory, DAP launch args

### Timing Control Patterns
- `vi.runAllTimersAsync()` for proper async operation sequencing
- `vi.advanceTimersByTimeAsync()` for precise timing control in race condition tests
- Event emission simulation with controlled delays

### Error Testing Strategies
- Systematic error injection through mock method overrides
- Graceful degradation validation (empty arrays, logged errors)
- Resource cleanup verification despite failures
- Double-close protection and edge case resilience

## Critical Invariants Validated

### State Machine Correctness
- All state transitions must follow valid paths
- Operations restricted by current state (e.g., stepping only when paused)
- Error states properly handle cleanup and resource release

### Resource Management
- Event listeners properly attached and cleaned up
- Proxy processes terminated on session close
- Memory leak prevention through proper event handler management

### Cross-Session Isolation
- Multiple concurrent sessions maintain independent state
- Operations on one session don't affect others
- Bulk operations handle individual session failures gracefully

### Backward Compatibility
- Legacy SessionState enum mapping preserved
- Round-trip state conversions maintain semantic equivalence
- Migration path from single-state to dual-state model supported