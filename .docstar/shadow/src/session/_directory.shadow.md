# src\session/
@children-hash: 5dc886a25cf6750f
@generated: 2026-02-23T19:00:32Z

## Purpose
The `session` directory provides comprehensive debug session management for the DebugMCP project, orchestrating the complete lifecycle of debug sessions from creation through termination while managing data retrieval, state persistence, and debug operations.

## Architecture Overview
The module follows a layered architecture with clear separation of concerns through inheritance:

```
SessionManager (main entry point)
    ↓ extends
SessionManagerOperations (debug operations)
    ↓ extends 
SessionManagerData (data retrieval)
    ↓ extends
SessionManagerCore (base lifecycle management)
```

With `SessionStore` as an independent pure data layer for state management.

## Key Components

### Core Foundation (`SessionManagerCore`)
- Abstract base class providing session lifecycle management, proxy event handling, and dependency injection
- Factory-based creation pattern with comprehensive DI container (`SessionManagerDependencies`)
- Event-driven architecture with proper cleanup patterns using WeakMap for memory management
- Dual state model supporting legacy `SessionState` and new `SessionLifecycleState`/`ExecutionState`

### Data Layer (`SessionStore`) 
- Pure in-memory storage using Map<string, ManagedSession> for session state persistence
- Policy pattern implementation mapping `DebugLanguage` to adapter policies (Python, JavaScript, Rust, Go, Mock)
- Interface segregation exposing public `DebugSessionInfo` while maintaining internal `ManagedSession`
- UUID-based session identification with automatic timestamp management

### Data Operations (`SessionManagerData`)
- Debug Adapter Protocol (DAP) communication for retrieving variables, stack traces, and scopes
- Language-specific data filtering through adapter policy integration
- Structured data transformation from DAP responses to internal Variable/StackFrame formats
- Multi-step orchestration in `getLocalVariables()` combining stack/scope/variable operations

### Debug Operations (`SessionManagerOperations`)
- High-level debugging operations: stepping, breakpoints, expression evaluation, attach/detach
- Event-driven step operations with timeout handling and location capture
- Comprehensive session startup through `startDebugging()` with adapter-specific configuration
- Process attachment/detachment capabilities with proper cleanup

### Main Interface (`SessionManager`)
- Primary entry point extending SessionManagerOperations to provide complete API surface
- Type re-exports for external consumption
- Composition point designed for future expansion

## Public API Surface

### Primary Entry Points
- `SessionManager` class: Main interface for all session management operations
- `createSession()`: Initialize new debug session with language/name/path
- `startDebugging()`: Launch debug session with comprehensive error handling
- `attachToProcess()` / `detachFromProcess()`: Process attachment operations

### Debug Operations
- Step operations: `stepOver()`, `stepInto()`, `stepOut()`
- Control flow: `continue()`, `setBreakpoint()`
- Data inspection: `getVariables()`, `getStackTrace()`, `getLocalVariables()`
- Expression evaluation: `evaluateExpression()`

### Session Management
- `closeSession()` / `closeAllSessions()`: Safe termination with cleanup
- State queries through SessionStore methods

## Internal Organization & Data Flow

1. **Session Creation**: SessionManager → SessionStore (creates ManagedSession) → ProxyManager setup
2. **Debug Launch**: SessionManagerOperations orchestrates adapter creation → proxy startup → event handler registration
3. **Runtime Operations**: Debug commands flow through DAP via ProxyManager → state updates in SessionStore
4. **Data Retrieval**: SessionManagerData queries DAP → applies policy filtering → transforms to internal types
5. **Cleanup**: Event handlers trigger cleanup → SessionStore removal → resource deallocation

## Key Patterns & Conventions

### Dependency Injection
- `SessionManagerDependencies` interface provides comprehensive DI container
- Factory pattern for ProxyManager, SessionStore, and DebugTargetLauncher creation
- Enables testing and modularity

### Error Handling
- Structured `DebugResult` interface with success/error states and machine-readable error types
- Consistent validation patterns across all operations
- Comprehensive logging with sessionId prefixes for traceability

### State Management
- Dual state model supporting migration from legacy to new state architecture
- Automatic state mapping and synchronization
- WeakMap usage for memory leak prevention in event handler tracking

### Language Extensibility
- Policy pattern through adapter policies for language-specific behaviors
- Adapter registry for dynamic debug adapter creation
- Configurable launch arguments and toolchain validation

## Dependencies
- **Internal**: FileSystem, NetworkManager, Logger, ProxyManager, DebugTargetLauncher, Environment
- **External**: VSCode Debug Adapter Protocol, uuid, @debugmcp/shared types
- **Architecture**: Clean dependency injection enabling testing and modularity