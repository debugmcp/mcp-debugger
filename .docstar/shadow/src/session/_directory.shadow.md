# src\session/
@generated: 2026-02-12T21:05:48Z

## Session Management Module

**Primary Purpose**: Comprehensive debug session management system providing lifecycle control, data operations, and protocol interactions for multi-language debugging. Implements a layered architecture from data storage through high-level operations with VSCode Debug Adapter Protocol (DAP) integration.

### Architecture Overview

The module follows a **hierarchical inheritance pattern** with clear separation of concerns:

```
SessionStore (data layer)
    ↓
SessionManagerCore (lifecycle & events)  
    ↓
SessionManagerData (data retrieval)
    ↓  
SessionManagerOperations (debug operations)
    ↓
SessionManager (main facade)
```

Each layer builds upon the previous, creating a comprehensive debugging platform that handles everything from session storage to complex debugging operations.

### Key Components

**SessionStore** - Pure data management layer providing stateful storage of debug sessions without external dependencies. Manages session creation, state transitions, and collection operations using in-memory Map storage with UUID-based session identification.

**SessionManagerCore** - Abstract base class providing core session lifecycle management, proxy event handling, and dependency injection architecture. Handles session creation/teardown, state transitions, and comprehensive event listener management for debug adapter communication.

**SessionManagerData** - Data retrieval operations layer that fetches variables, stack traces, and scopes from debug adapters. Applies language-specific policies for filtering and variable extraction, providing the foundation for debugging inspection.

**SessionManagerOperations** - Complete debugging operations implementation including process starting/stopping, stepping, breakpoint management, expression evaluation, and process attachment. Acts as the primary interface for debug protocol interactions.

**SessionManager** - Main entry point facade that composes all functionality and provides the public API for debug session management.

### Public API Surface

**Primary Entry Points**:
- `SessionManager` class - Main interface for all debug session operations
- Session lifecycle: `createSession()`, `closeSession()`, `closeAllSessions()`
- Debug operations: `startDebugging()`, `stepOver()`, `stepInto()`, `stepOut()`
- Breakpoint management: `setBreakpoint()`
- Data inspection: `getVariables()`, `getStackTrace()`, `getLocalVariables()`
- Expression evaluation: `evaluateExpression()`
- Process operations: `attachToProcess()`, `detachFromProcess()`

**Key Type Exports**:
- `SessionManagerDependencies` - Dependency injection container
- `SessionManagerConfig` - Configuration options
- `CustomLaunchRequestArguments` - Extended launch parameters
- `DebugResult` - Standardized operation responses
- `EvaluateResult` - Expression evaluation results

### Internal Organization & Data Flow

**Session Lifecycle Flow**:
1. **Creation**: SessionStore generates UUID, validates language, initializes ManagedSession
2. **Activation**: SessionManagerCore creates proxy managers, sets up event handlers
3. **Operations**: SessionManagerOperations handles debug protocol interactions
4. **Data Access**: SessionManagerData retrieves runtime information
5. **Cleanup**: Comprehensive teardown with event handler cleanup and state transitions

**Event-Driven Architecture**: Proxy managers emit debug events that flow through SessionManagerCore's event handling system, maintaining state synchronization and enabling reactive debugging workflows.

**Language Adapter Integration**: Uses adapter registry pattern to delegate language-specific behavior (executable resolution, command building, policy application) while maintaining consistent API across all supported languages.

### Important Patterns & Conventions

**Dependency Injection**: Complete constructor injection with interface-based dependencies enables testability and modularity across the entire session management stack.

**Dual State Model**: Supports both legacy SessionState and new SessionLifecycleState/ExecutionState models, indicating ongoing architectural evolution while maintaining backward compatibility.

**Error Resilience**: Comprehensive error handling with continuation on failure, structured logging for debugging, and automatic cleanup to prevent resource leaks.

**Policy-Based Language Support**: Language-specific behavior handled through adapter policies (Python, JavaScript, Rust, Go, Mock) with consistent fallback patterns.

**Memory Management**: Uses WeakMap for event handlers and careful cleanup patterns to prevent memory leaks in long-running debugging scenarios.

This module serves as the core debugging engine, abstracting complex DAP interactions and multi-language toolchain management while providing a clean, consistent API for debug session control and inspection.