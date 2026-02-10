# src/session/
@generated: 2026-02-10T21:26:25Z

## Session Management Module

**Primary Purpose**: Complete debug session lifecycle management system providing high-level debugging operations, data retrieval, and state management for IDE integrations. Implements the Microsoft Debug Adapter Protocol (DAP) with language-specific policy support and comprehensive session orchestration.

### Architecture Overview

The module follows a layered inheritance pattern with clear separation of concerns:

```
SessionManager (main entry point)
    ↓ extends
SessionManagerOperations (debugging operations)
    ↓ extends  
SessionManagerData (data retrieval)
    ↓ extends
SessionManagerCore (lifecycle & events)
    ↓ uses
SessionStore (pure data layer)
```

### Key Components

#### SessionStore (session-store.ts)
**Pure data layer** providing stateful storage without external dependencies. Core responsibilities:
- In-memory session storage using Map<string, ManagedSession>
- Language-specific adapter policy selection (Python, JavaScript, Rust, Go, Mock)
- Session CRUD operations with dual state model support (legacy + new lifecycle states)
- UUID-based session identification with automatic timestamp management

#### SessionManagerCore (session-manager-core.ts) 
**Abstract foundation class** implementing core session lifecycle management:
- Dependency injection container for all required services (filesystem, network, logging, factories)
- Event-driven proxy management with named handlers for DAP lifecycle events
- Graceful session termination with proper cleanup and state transitions
- Auto-continue support for `stopOnEntry=false` scenarios
- Memory-safe event handler management using WeakMap patterns

#### SessionManagerData (session-manager-data.ts)
**Data retrieval layer** extending core functionality with debugging inspection operations:
- Variable fetching by reference ID with DAP protocol translation
- Stack trace retrieval with language-specific filtering via adapter policies
- Scope enumeration for variable containers
- High-level `getLocalVariables()` orchestrating multi-step data collection

#### SessionManagerOperations (session-manager-operations.ts)
**Complete debugging operations** implementing full DAP command set:
- Session initialization with dry-run support and toolchain validation
- Step execution operations (stepOver, stepInto, stepOut, continue)
- Breakpoint management with DAP synchronization
- Expression evaluation with context support
- Process attachment/detachment for remote debugging
- Comprehensive error handling with structured logging

#### SessionManager (session-manager.ts)
**Main facade** and composition point providing the complete public API through inheritance from SessionManagerOperations.

### Public API Surface

#### Primary Entry Point
- **SessionManager**: Complete session management interface

#### Key Operations
- `createSession(language, name?, executablePath?)`: Initialize new debug session
- `startDebugging(sessionId, config)`: Begin debug session with launch/attach configuration
- `setBreakpoint(sessionId, file, line)`: Set breakpoints with DAP synchronization
- `stepOver/stepInto/stepOut(sessionId)`: Step execution control
- `continue(sessionId)`: Resume execution
- `evaluateExpression(sessionId, expression, context?)`: Evaluate expressions in debug context
- `attachToProcess/detachFromProcess(sessionId, processId)`: Remote debugging support

#### Data Retrieval
- `getVariables(sessionId, variablesReference)`: Fetch variables by reference
- `getStackTrace(sessionId, threadId?)`: Retrieve call stack with filtering
- `getLocalVariables(sessionId)`: High-level local variable extraction

#### Session Management
- `closeSession(sessionId)`: Graceful session termination
- `closeAllSessions()`: Bulk cleanup for shutdown

### Internal Organization & Data Flow

1. **Session Creation**: SessionStore generates UUID, applies language policies, initializes ManagedSession
2. **Proxy Management**: SessionManagerCore creates language-specific debug adapter proxies via factory pattern
3. **Event Handling**: Named event handlers manage proxy lifecycle (stopped, continued, terminated, etc.)
4. **State Synchronization**: Dual state model tracking (legacy SessionState + new SessionLifecycleState/ExecutionState)
5. **Data Operations**: Policy-driven data extraction with language-specific filtering and transformation
6. **Cleanup**: WeakMap-based memory management with comprehensive resource cleanup

### Important Patterns

#### Dependency Injection
Complete DI container (`SessionManagerDependencies`) enabling testability and service composition.

#### Factory Pattern  
Language-specific adapter and proxy creation through configurable factories.

#### Policy Pattern
Language-specific behavior delegation through `AdapterPolicy` implementations for data filtering and executable resolution.

#### Event-Driven Architecture
Proxy lifecycle managed through structured event handlers with proper cleanup and error resilience.

#### State Machine
Validated state transitions through proper session lifecycle with dual model support during migration.

### Critical Dependencies

- **@debugmcp/shared**: Core types, state management, and adapter policies
- **@vscode/debugprotocol**: Microsoft DAP protocol definitions  
- **uuid**: Session ID generation
- Platform services: filesystem, network, logging, environment abstractions

### Key Invariants

- Sessions must progress through valid state sequences (CREATED → RUNNING → PAUSED/STOPPED)
- Event handlers require proper cleanup before proxy termination
- All operations validate session state and proxy availability
- Language policies provide filtering and executable resolution for each supported language
- Resource cleanup prevents memory leaks through WeakMap event management