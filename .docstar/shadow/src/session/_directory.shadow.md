# src/session/
@generated: 2026-02-10T01:19:46Z

## Session Management Module

**Overall Purpose**: Core debug session management system providing complete lifecycle orchestration, data operations, and state management for debug adapters. Implements a layered architecture that separates storage, operations, and control flow for maximum testability and maintainability.

## Key Components & Architecture

### Layered Inheritance Design
The module follows a structured inheritance hierarchy that separates concerns:

1. **SessionManagerCore** (base): Abstract foundation providing dependency injection, event handling, and proxy lifecycle management
2. **SessionManagerData** (extends Core): Adds data retrieval operations for variables, stack traces, and scopes with language-specific policies  
3. **SessionManagerOperations** (extends Data): Implements complete debug operations including launching, stepping, breakpoints, and expression evaluation
4. **SessionManager** (extends Operations): Main entry point and facade class

### Pure Data Layer
**SessionStore**: Isolated storage layer managing session state without external dependencies. Uses Map-based storage with UUID session IDs and supports dual state models (legacy + new lifecycle states). Implements policy pattern for language-specific behavior delegation.

## Public API Surface

### Primary Entry Points
- **SessionManager**: Main class providing complete debug session management interface
- **SessionStore**: Direct session storage operations for specialized use cases
- **SessionManagerDependencies**: Dependency injection container interface defining required services

### Core Operations
- **Session Lifecycle**: `createSession()`, `startDebugging()`, `closeSession()`, `closeAllSessions()`
- **Debug Control**: `stepOver()`, `stepInto()`, `stepOut()`, breakpoint management
- **Data Inspection**: `getVariables()`, `getStackTrace()`, `getScopes()`, `getLocalVariables()`
- **Process Management**: `attachToProcess()`, `detachFromProcess()`
- **Expression Evaluation**: `evaluateExpression()` with automatic frame detection

### Configuration Types
- **CustomLaunchRequestArguments**: VSCode debug protocol extensions
- **SessionManagerConfig**: Logging, timeout, and launch configuration
- **DebugResult**: Standardized result interface with MCP error codes

## Internal Organization & Data Flow

### Session Creation Flow
1. **SessionStore.createSession()** → UUID generation, language validation, policy selection
2. **SessionManagerOperations.startProxyManager()** → Adapter configuration, executable resolution
3. **SessionManagerOperations.startDebugging()** → Proxy initialization, handshakes, state transitions
4. **Event handler setup** → Lifecycle management through proxy events

### State Management
- **Dual State Model**: Legacy `SessionState` + new `SessionLifecycleState`/`ExecutionState` 
- **Event-Driven Updates**: Proxy events trigger state transitions via `setupProxyEventHandlers()`
- **Thread Tracking**: Multi-threaded debugging support with threadId management

### Data Retrieval Pipeline
1. **Session validation** → State checks (PAUSED required)
2. **Language policy selection** → Maps debug language to appropriate adapter policy
3. **DAP communication** → Variables/stack/scope requests via proxy manager
4. **Policy filtering** → Language-specific data transformation and filtering
5. **Result structuring** → Internal format conversion for consistency

## Important Patterns & Conventions

### Dependency Injection
Complete DI container pattern enables testability and modularity:
- Filesystem, network, logging services
- Factory patterns for proxy managers and session stores
- Adapter registry for debug protocol implementations

### Memory Management
- **WeakMap event handlers**: Prevents memory leaks during session cleanup
- **Structured cleanup sequences**: Event handler removal before proxy termination
- **Double-cleanup protection**: Resilient cleanup with error handling

### Error Handling
- **Graceful degradation**: Operations return empty results rather than throwing
- **Comprehensive logging**: Structured debug output with session ID prefixes
- **State validation**: Pre-operation checks prevent invalid state transitions

### Language Agnostic Design
- **Adapter policies**: Language-specific behavior through policy pattern
- **Protocol abstraction**: VSCode Debug Adapter Protocol communication layer
- **Toolchain validation**: Dynamic adapter compatibility checking

### Special Features
- **Dry-run mode**: Command validation without execution for testing
- **Auto-continue support**: Configurable `stopOnEntry` behavior with policy overrides
- **JDWP detection**: Automatic Java debug configuration
- **Process attachment**: Runtime attachment to existing processes

The module provides a complete, production-ready debug session management system with clear separation of concerns, comprehensive error handling, and language-agnostic extensibility.