# tests/core/unit/session/
@generated: 2026-02-09T18:16:18Z

## Purpose
Comprehensive unit test suite for the SessionManager class in the DebugMCP system. This directory validates all aspects of debug session lifecycle management, from state transitions and DAP protocol operations to error handling and multi-session coordination.

## Test Architecture & Coverage

### Core Test Categories
The test suite is organized into 10 specialized test files, each targeting specific SessionManager functionality:

**State Management & Models**
- `models.test.ts` - Session state mapping functions and enum validation
- `session-manager-state.test.ts` - State machine transitions and enforcement

**Debug Adapter Protocol (DAP) Operations**
- `session-manager-dap.test.ts` - Breakpoint management, step operations, variable inspection
- `session-manager-workflow.test.ts` - End-to-end debugging workflows and complete cycles

**Error Handling & Resilience**
- `session-manager-edge-cases.test.ts` - Boundary conditions and graceful degradation
- `session-manager-error-recovery.test.ts` - Crash recovery and timeout handling
- `session-manager-dry-run.test.ts` - Race conditions and timing edge cases

**Resource Management**
- `session-manager-memory-leak.test.ts` - Event listener cleanup and memory leak prevention
- `session-manager-multi-session.test.ts` - Concurrent session isolation and coordination

**Platform Support**
- `session-manager-paths.test.ts` - Cross-platform path resolution (Windows/Unix)

### Key Components Tested

**SessionManager Class**
- Primary entry point managing debug session lifecycle
- Handles state transitions between CREATED → INITIALIZING → PAUSED/RUNNING → STOPPED/ERROR
- Coordinates with ProxyManager for DAP protocol communication
- Manages breakpoints, step operations, and variable inspection

**State Mapping Functions**
- `mapLegacyState()` - Converts flat legacy states to hierarchical model
- `mapToLegacyState()` - Backward compatibility mapping
- Ensures bidirectional consistency between SessionState and SessionLifecycleState + ExecutionState

**Mock Infrastructure**
- `session-manager-test-utils.ts` - Centralized mock factory and utilities
- Provides MockProxyManager, dependency injection, and test configuration
- Ensures consistent test setup across all test files

## Public API Testing Coverage

### Session Lifecycle Methods
- `createSession()` - Session creation with configuration validation
- `startDebugging()` - Debug session initialization with DAP setup
- `closeSession()` / `closeAllSessions()` - Proper cleanup and resource deallocation

### DAP Operation Methods  
- `setBreakpoints()` - Breakpoint management with conditional support
- `step()`, `stepOver()`, `stepInto()`, `stepOut()` - Step execution operations
- `continue()` - Resume execution from paused state
- `getVariables()`, `getStackTrace()`, `getScopes()` - Runtime inspection

### State Query Methods
- `getSession()` - Individual session retrieval
- `getAllSessions()` - Multi-session state management
- Session state validation and transition monitoring

## Internal Organization & Data Flow

### Dependencies & Injection
Tests use comprehensive dependency injection through `createMockDependencies()`:
- ProxyManager for DAP protocol communication
- FileSystem, Logger, Environment abstraction layers
- NetworkManager for port allocation
- SessionStore for persistence
- DebugTargetLauncher for process management

### Event-Driven Architecture
SessionManager operates through event-driven patterns:
- ProxyManager events (stopped, continued, terminated, error)
- Automatic state transitions based on debug adapter events
- Event listener lifecycle management for memory leak prevention

### Error Handling Patterns
- Graceful degradation with empty array returns for inspection failures
- ProxyNotRunningError for invalid state operations
- Timeout mechanisms for DAP operations and initialization
- Structured error responses with success/error fields

## Critical Design Validation

### Backward Compatibility
Tests ensure seamless migration between legacy flat state model and new hierarchical state model, with intentional round-trip inconsistencies for specific legacy states (READY → INITIALIZING).

### Multi-Session Isolation
Validates that concurrent debug sessions maintain independent state, proxy managers, and event handling without cross-contamination.

### Resource Cleanup
Comprehensive memory leak prevention through proper event listener cleanup, even during error conditions and unexpected terminations.

### Platform Independence
Cross-platform path resolution testing ensures Windows and Unix path formats are handled correctly for breakpoint operations.

## Test Infrastructure
- **Framework**: Vitest with fake timers for deterministic async testing
- **Mocking**: Comprehensive mock infrastructure with vi.mock() and dependency injection
- **Coverage**: State transitions, DAP operations, error scenarios, edge cases, and integration workflows
- **Patterns**: Setup/teardown consistency, spy-based validation, event simulation, and structured assertions