# src\session/
@children-hash: b8a959ed8ce1e291
@generated: 2026-02-15T09:01:29Z

## Session Management Module

**Primary Purpose**: Complete debug session lifecycle management system providing stateful session storage, debug adapter protocol communication, and debugging operations (stepping, breakpoints, evaluation) through a layered architecture with dependency injection.

## Architecture Overview

The module follows a **layered inheritance pattern** with clear separation of concerns:

```
SessionStore (data layer)
    ↑
SessionManagerCore (lifecycle & events)
    ↑
SessionManagerData (data retrieval)
    ↑ 
SessionManagerOperations (debug operations)
    ↑
SessionManager (main facade)
```

## Core Components

### SessionStore
**Pure data layer** providing stateful session storage with UUID-based session management, dual state model support (legacy + new lifecycle states), and language-specific adapter policy selection. Acts as the foundational storage abstraction with no external dependencies.

### SessionManagerCore  
**Abstract base class** managing session lifecycle, state transitions, proxy event handling, and dependency injection architecture. Provides comprehensive event system for debug adapter protocol events (`stopped`, `continued`, `terminated`) with automatic cleanup and memory leak prevention.

### SessionManagerData
**Data retrieval operations** extending the core with methods to fetch variables, stack traces, and scopes from debug adapters. Applies language-specific filtering through adapter policies and provides high-level orchestration methods like `getLocalVariables()`.

### SessionManagerOperations
**Debug operations interface** providing all debugging functionality including session startup, stepping operations, breakpoint management, expression evaluation, and process attachment. Handles DAP communication and coordinates language-specific adapter behavior.

### SessionManager
**Main facade class** that composes all functionality and serves as the primary entry point for consumers. Currently minimal but designed as the main composition point.

## Key Data Flow

1. **Session Creation**: SessionStore creates ManagedSession → SessionManagerCore sets up proxy and events → SessionManagerOperations handles debug startup
2. **Debug Operations**: Operations layer validates state → sends DAP requests via proxy → updates session state via core layer
3. **Data Retrieval**: Data layer fetches from debug adapter → applies language policies → returns structured results
4. **Event Handling**: Proxy managers emit events → Core layer handles state transitions → Operations layer responds to debug events

## Public API Surface

### Primary Entry Points
- **SessionManager**: Main class providing complete debug session management
- **createSession()**: Initialize new debug sessions with language and executable
- **startDebugging()**: Launch debug processes with proxy setup and adapter handshake
- **Step Operations**: `stepOver()`, `stepInto()`, `stepOut()` for execution control
- **Breakpoint Management**: `setBreakpoint()` for debugging control points
- **Data Inspection**: `getVariables()`, `getStackTrace()`, `getLocalVariables()`
- **Expression Evaluation**: `evaluateExpression()` for REPL-style debugging
- **Process Control**: `attachToProcess()`, `detachFromProcess()` for runtime attachment

### Key Types & Interfaces
- **SessionManagerDependencies**: Complete dependency injection container
- **DebugResult**: Standardized operation response with success/error states
- **ManagedSession**: Rich session representation with proxy and state management
- **EvaluateResult**: Expression evaluation results with type information

## Internal Organization

### State Management
- **Dual State Model**: Supports both legacy `SessionState` and new `SessionLifecycleState`/`ExecutionState`
- **Event-Driven Updates**: Proxy events drive state transitions through centralized `_updateSessionState()`
- **Comprehensive Cleanup**: WeakMap-based event handler tracking prevents memory leaks

### Language Adaptation
- **Adapter Policy Pattern**: Language-specific behavior through policy selection (Python, JavaScript, Rust, Go, Mock)
- **Executable Resolution**: Delegates path resolution to language-specific adapters
- **Filtering & Transformation**: Applies language policies for data filtering and variable extraction

### Error Handling & Resilience
- **Comprehensive Error Capture**: Proxy log tails for diagnostics, language-specific error conversion
- **State Validation**: Consistent pre-operation state checking across all operations
- **Graceful Degradation**: Operations return empty results rather than throwing on failure

## Key Patterns & Conventions

- **Dependency Injection**: Full constructor injection with interface-based dependencies enabling testability
- **Factory Pattern**: Session store and proxy manager creation through factory methods
- **Event-Driven Architecture**: Loose coupling between proxy communication and session management
- **Interface Segregation**: Public interfaces expose minimal surface while maintaining rich internal representations
- **Structured Logging**: Comprehensive operation tracking with session ID prefixes
- **Auto-Continue Logic**: Handles `stopOnEntry=false` scenarios with automatic execution resumption

This module serves as the core debugging infrastructure, providing a complete abstraction over VSCode Debug Adapter Protocol communication while maintaining language-specific extensibility and robust session lifecycle management.