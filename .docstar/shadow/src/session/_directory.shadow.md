# src\session/
@generated: 2026-02-12T21:00:59Z

## Session Management Module

### Overall Purpose
The session module provides comprehensive debug session management functionality for VSCode debug adapters, implementing a layered architecture that handles the complete lifecycle of debugging sessions from creation through termination. This module serves as the primary interface between debug clients and language-specific debug adapters via the Debug Adapter Protocol (DAP).

### Architecture & Component Relationships

The module follows a clear inheritance hierarchy with separation of concerns:

```
SessionManagerCore (abstract base)
    ↓
SessionManagerData (data operations)
    ↓  
SessionManagerOperations (debug operations)
    ↓
SessionManager (main facade)
```

**SessionStore** provides pure data management as a composed dependency, maintaining session state independently of the manager hierarchy.

### Key Components

**SessionManagerCore** - Abstract foundation providing:
- Dependency injection architecture with complete service container
- Session lifecycle management and state transitions
- Proxy event handling system with comprehensive cleanup
- Dual state model support (legacy + new lifecycle states)
- Auto-continue logic for seamless debugging flow

**SessionManagerData** - Data access layer offering:
- Variable retrieval and inspection capabilities
- Stack trace fetching with language-specific filtering
- Scope enumeration for variable containers
- Policy-driven data transformation for different languages

**SessionManagerOperations** - Core debugging operations including:
- Session startup with dry-run capabilities
- Step operations (over/into/out) with thread management
- Breakpoint management and verification
- Expression evaluation for REPL-style debugging
- Process attachment and detachment

**SessionStore** - Pure storage layer providing:
- In-memory session persistence with UUID-based IDs
- Language-specific adapter policy selection
- State management with automatic timestamping
- Collection operations with filtered public interfaces

**SessionManager** - Main facade that composes all functionality through inheritance and provides the primary public API.

### Public API Surface

**Primary Entry Point**: `SessionManager` class providing complete session management interface

**Core Operations**:
- `createSession(language, name?, executablePath?)` - Initialize new debug sessions
- `startDebugging(sessionId, options?)` - Launch debug processes with adapter configuration
- `attachToProcess(sessionId, target)` - Attach to running processes
- `stepOver/stepInto/stepOut(sessionId, threadId?)` - Execution control
- `setBreakpoint(sessionId, location)` - Breakpoint management
- `evaluateExpression(sessionId, expression, context)` - REPL evaluation
- `getVariables/getStackTrace/getScopes(sessionId, ...)` - Runtime inspection
- `closeSession/closeAllSessions()` - Session cleanup

**Configuration Types**:
- `SessionManagerDependencies` - Complete dependency injection container
- `SessionManagerConfig` - Logging, timeouts, and launch defaults
- `CustomLaunchRequestArguments` - Extended DAP launch options

### Internal Organization & Data Flow

1. **Session Creation**: SessionStore generates UUID-based sessions with language validation
2. **Adapter Setup**: Language adapters resolve executables and build DAP configurations  
3. **Proxy Management**: ProxyManager instances handle DAP communication per session
4. **Event Processing**: Comprehensive event handlers manage state transitions and cleanup
5. **Data Operations**: Policy-driven data retrieval with language-specific filtering
6. **State Synchronization**: Dual state tracking ensures compatibility during migration

### Important Patterns & Conventions

**Dependency Injection**: Full constructor injection with interface-based dependencies enables testing and modularity

**Event-Driven Architecture**: Proxy managers emit events handled by session managers for loose coupling

**Policy Pattern**: Language-specific behavior through adapter policies (Python, JavaScript, Rust, Go, Mock)

**Error Resilience**: Comprehensive error handling with operation continuation and diagnostic logging

**Resource Management**: WeakMap usage and explicit cleanup prevent memory leaks in long-running processes

**State Management**: Centralized state transitions with logging and dual model support for migration scenarios

The module provides a robust, extensible foundation for multi-language debug session management with clear separation between data storage, debug operations, and adapter communication.