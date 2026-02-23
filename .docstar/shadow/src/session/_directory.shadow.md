# src\session/
@children-hash: 1b833d59bce14d99
@generated: 2026-02-23T15:26:40Z

## Overall Purpose

The `src/session` module provides comprehensive debug session management functionality for a multi-language debugging system. It orchestrates the complete lifecycle of debug sessions from creation through termination, managing state, coordinating with debug adapters, and providing data access operations. The module serves as the primary interface between the debugging framework and language-specific debug adapters via the Debug Adapter Protocol (DAP).

## Architecture & Component Organization

The module follows a layered inheritance architecture with clear separation of concerns:

### Core Hierarchy
- **SessionManagerCore** → **SessionManagerData** → **SessionManagerOperations** → **SessionManager**
- **SessionStore** (standalone data layer)

Each layer adds specific capabilities while maintaining clean abstractions and dependency injection patterns.

### Key Components

**SessionManagerCore** (session-manager-core.ts)
- Abstract foundation providing session lifecycle management, event handling, and proxy coordination
- Manages dual state model transition (legacy SessionState + new SessionLifecycleState/ExecutionState)
- Implements comprehensive event handler architecture for proxy lifecycle events
- Provides dependency injection framework and memory-safe event management

**SessionManagerData** (session-manager-data.ts)
- Data retrieval layer for variables, stack traces, and scopes
- Language-specific policy application through adapter selection
- Transforms DAP responses to internal data structures
- Provides high-level data orchestration methods

**SessionManagerOperations** (session-manager-operations.ts)
- Core debug operations: start/stop debugging, stepping, breakpoints, expression evaluation
- Process attach/detach capabilities
- Complex session initialization with dry-run support
- Comprehensive error handling and timeout management

**SessionManager** (session-manager.ts)
- Main public entry point and facade
- Composes all functionality through inheritance
- Re-exports key types for consumer convenience

**SessionStore** (session-store.ts)
- Pure data management layer with no external dependencies
- In-memory session storage with UUID-based identification
- Language policy selection and executable resolution
- Dual state model support for ongoing architecture migration

## Public API Surface

### Main Entry Points
- `SessionManager` class - Primary interface for all session operations
- `createSession(language, name?, executablePath?)` - Session initialization
- `startDebugging(sessionId, options?)` - Begin debug session with dry-run support
- `closeSession(sessionId)` / `closeAllSessions()` - Session termination

### Debug Control Operations
- `stepOver()`, `stepInto()`, `stepOut()` - Step-by-step execution
- `continue()` - Resume execution from paused state
- `setBreakpoint(sessionId, file, line)` - Breakpoint management
- `evaluateExpression(sessionId, expression, context?)` - Expression evaluation

### Data Access Operations
- `getVariables(sessionId, variablesReference)` - Variable inspection
- `getStackTrace(sessionId, threadId?)` - Call stack retrieval
- `getLocalVariables(sessionId)` - Complete local variable context
- `getScopes(sessionId, frameId)` - Variable scope enumeration

### Process Management
- `attachToProcess(sessionId, processId)` - Attach to running process
- `detachFromProcess(sessionId, terminateProcess?)` - Detach from process

## Data Flow & Integration Patterns

### Session Lifecycle
1. **Creation**: SessionStore generates UUID, validates language, resolves executable paths
2. **Initialization**: SessionManagerOperations creates adapter config, validates toolchain
3. **Proxy Setup**: SessionManagerCore establishes ProxyManager with DAP communication
4. **Event Management**: Comprehensive event handlers manage proxy lifecycle states
5. **Operations**: Debug commands flow through ProxyManager to language-specific adapters
6. **State Synchronization**: Updates propagate through SessionStore with automatic timestamps
7. **Cleanup**: Safe termination with proxy cleanup and event handler removal

### Language Support
- **Policy-Based Architecture**: Each supported language (Python, JavaScript, Rust, Go, Mock) has dedicated adapter policies
- **Dynamic Selection**: Language detection drives policy selection and executable resolution
- **Toolchain Validation**: Compatibility checking with continuation policies for missing dependencies

### Error Handling Strategy
- **Structured Error Types**: SessionTerminatedError, ProxyNotRunningError, etc.
- **Graceful Degradation**: Operations return empty results rather than throwing exceptions
- **Comprehensive Logging**: Structured logs with session ID prefixes for debugging
- **Timeout Management**: Async operations protected with configurable timeouts

## Key Patterns & Conventions

### Dependency Injection
All components use comprehensive DI containers (SessionManagerDependencies) for testability and modularity.

### Memory Management
- WeakMap usage for event handler tracking prevents memory leaks
- Proper cleanup patterns for event listeners and proxy resources
- Factory-based creation patterns for component lifecycle management

### State Management
- Dual state model supports migration from legacy to new architecture
- Automatic state mapping ensures backward compatibility
- Thread-safe event handler management with stale event guards

### Data Transformation
- Consistent mapping between DAP types and internal representations
- Language-specific filtering through adapter policies
- Structured result interfaces with machine-readable error types

The module serves as the central orchestration point for multi-language debugging, providing a unified interface while maintaining language-specific behavior through policy patterns and adapter coordination.