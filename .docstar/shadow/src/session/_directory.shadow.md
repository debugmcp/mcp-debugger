# src\session/
@children-hash: 5a2d79297d3549d5
@generated: 2026-02-19T23:48:21Z

## Purpose
The session module provides a complete debug session management system for the DebugMCP framework. It handles the full lifecycle of debugging sessions including creation, execution control, data inspection, and cleanup. The module serves as the primary interface between debug adapters and client applications, managing Debug Adapter Protocol (DAP) communication and maintaining session state.

## Architecture Overview
The module follows a layered architecture with clear separation of concerns:

- **SessionStore**: Pure data management layer for session storage and retrieval
- **SessionManagerCore**: Abstract base providing session lifecycle, event handling, and dependency injection
- **SessionManagerData**: Data retrieval operations for variables, stack traces, and scopes
- **SessionManagerOperations**: Core debugging operations (stepping, breakpoints, evaluation)
- **SessionManager**: Main facade composing all functionality

Each layer extends the previous, creating a hierarchy where higher layers have access to all lower-layer functionality while maintaining focused responsibilities.

## Key Components and Relationships

### SessionStore
- **Purpose**: Stateless data layer managing ManagedSession objects in memory
- **Key Features**: UUID-based session IDs, dual state model support (legacy + new), language-specific adapter policy selection
- **Interface**: Clean separation between public DebugSessionInfo and internal ManagedSession representations

### SessionManagerCore (Abstract Base)
- **Purpose**: Foundational session lifecycle management and event handling
- **Key Features**: Dependency injection architecture, proxy manager integration, sophisticated event cleanup via WeakMap
- **Patterns**: Factory pattern for proxy/store creation, event-driven state management, auto-continue logic

### SessionManagerData (Abstract)
- **Purpose**: Debug data inspection and retrieval operations
- **Key Features**: Language-aware variable filtering via adapter policies, DAP communication for data requests
- **Operations**: getVariables(), getStackTrace(), getScopes(), getLocalVariables()

### SessionManagerOperations (Abstract)
- **Purpose**: Core debugging operations and process management
- **Key Features**: Session start/stop, stepping operations, breakpoint management, expression evaluation, process attachment
- **Critical Methods**: startDebugging(), step operations (over/into/out), setBreakpoint(), evaluateExpression(), attachToProcess()

### SessionManager (Concrete Implementation)
- **Purpose**: Main entry point and complete session management interface
- **Role**: Facade pattern providing unified API surface
- **Current State**: Minimal implementation focusing on type re-exports

## Public API Surface

### Primary Entry Points
- **SessionManager class**: Main interface for all session operations
- **createSession()**: Initialize new debug sessions with language and executable parameters
- **startDebugging()**: Launch debug processes with full DAP setup
- **Stepping operations**: stepOver(), stepInto(), stepOut() for execution control
- **Data inspection**: getVariables(), getStackTrace(), getLocalVariables()
- **Breakpoint management**: setBreakpoint() for debugging control points
- **Expression evaluation**: evaluateExpression() for REPL-style interaction
- **Process attachment**: attachToProcess(), detachFromProcess() for remote debugging

### Key Type Exports
- **SessionManagerDependencies**: Dependency injection interface
- **SessionManagerConfig**: Configuration options
- **CustomLaunchRequestArguments**: Extended DAP launch arguments
- **DebugResult**: Standardized operation results
- **EvaluateResult**: Expression evaluation responses

## Internal Organization and Data Flow

### Session Lifecycle
1. **Creation**: SessionStore creates ManagedSession with UUID and adapter policy
2. **Initialization**: SessionManagerCore sets up proxy managers and event handlers
3. **Execution**: SessionManagerOperations handles DAP communication and state transitions
4. **Data Operations**: SessionManagerData provides inspection capabilities during pause states
5. **Cleanup**: Comprehensive event handler cleanup and resource management

### State Management
- **Dual State Model**: Legacy SessionState + new SessionLifecycleState/ExecutionState
- **State Synchronization**: mapLegacyState() maintains consistency during transition
- **Event-Driven Updates**: Proxy lifecycle events trigger state changes

### Communication Flow
- **Inbound**: Client requests → SessionManager → Operations/Data layers → SessionStore
- **Outbound**: Debug Adapter Protocol → ProxyManager → Event handlers → State updates
- **Error Handling**: Categorized errors with machine-readable types, graceful degradation

## Important Patterns and Conventions

### Dependency Injection
Full constructor injection pattern enables testability and modularity. All external dependencies (filesystem, networking, logging) are injected rather than hardcoded.

### Error Handling Strategy
- Comprehensive error categorization with errorType and errorCode
- Operation continuation despite cleanup failures
- Extensive logging with structured information for debugging

### Language Adaptation
- Adapter policy pattern for language-specific behavior
- Policy selection based on DebugLanguage enum
- Filtering and transformation rules per language (Python, JavaScript, Rust, Go, Mock)

### Memory Management
- WeakMap-based event handler tracking prevents memory leaks
- Explicit cleanup methods for all resource types
- Testing hooks for verifying cleanup behavior

### Testing Support
- Pure data layer (SessionStore) enables isolated unit testing
- _testOnly_ methods expose internal cleanup for verification
- Factory pattern allows mock injection for testing

## Critical Dependencies
- **@debugmcp/shared**: Core types, enums, and adapter policies
- **@vscode/debugprotocol**: DAP protocol definitions and types
- **uuid**: Session identifier generation
- **Adapter Registry**: Language-specific debug adapter creation
- **Proxy Managers**: DAP communication and process management
- **Logging Framework**: Structured logging with session context