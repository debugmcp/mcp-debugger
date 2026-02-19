# src\session\session-manager-core.ts
@source-hash: b9f1b4d2877f22f3
@generated: 2026-02-19T23:47:46Z

## Purpose
Core abstract class providing session management functionality for debug sessions, including lifecycle management, state transitions, event handling, and dependency injection architecture. Serves as base for concrete session manager implementations.

## Key Classes and Interfaces

### `SessionManagerCore` (L68-401)
Abstract base class managing debug session lifecycle and state transitions.

**Key Properties:**
- `sessionStore: SessionStore` (L69) - Central session storage
- `sessionEventHandlers: WeakMap` (L84) - Event handler cleanup tracking
- `adapterRegistry: IAdapterRegistry` (L78) - Public registry for debug adapters
- Configuration properties for logging, DAP launch args, and timeouts (L80-81)

**Key Methods:**
- `constructor(config, dependencies)` (L89-112) - Full dependency injection setup
- `createSession(params)` (L114-123) - Creates new debug session
- `closeSession(sessionId)` (L156-194) - Graceful session cleanup with proxy management
- `closeAllSessions()` (L196-203) - Bulk session cleanup
- `setupProxyEventHandlers(session, proxyManager, launchArgs)` (L205-355) - Event binding for proxy lifecycle
- `cleanupProxyEventHandlers(session, proxyManager)` (L357-387) - Safe event handler removal
- `handleAutoContinue()` (L400) - Abstract method for subclass implementation

### Interfaces

**`CustomLaunchRequestArguments` (L25-28)** - Extends VSCode debug protocol with custom options
**`DebugResult` (L31-40)** - Standardized operation result with error categorization
**`SessionManagerDependencies` (L45-54)** - Complete dependency injection interface
**`SessionManagerConfig` (L59-63)** - Configuration options for session manager

## Architecture Patterns

### Dependency Injection
Full constructor injection of all dependencies (filesystem, networking, logging, factories) enabling testability and modularity.

### Event-Driven State Management
Sophisticated event handling system using WeakMap for automatic cleanup prevention of memory leaks. Handles proxy lifecycle events (stopped, continued, terminated, etc.) with named functions for better debugging.

### State Synchronization
Dual state management - maintains legacy `SessionState` while transitioning to new lifecycle/execution state model via `mapLegacyState()` (L141).

### Factory Pattern
Uses factories for proxy manager and session store creation, enabling different implementations per environment.

## Critical Invariants

1. **Event Handler Cleanup**: Event handlers must be cleaned up when sessions close to prevent memory leaks (L357-387)
2. **State Consistency**: Session state updates must maintain consistency between legacy and new state models (L133-146)
3. **Proxy Lifecycle**: Proxy managers must be stopped and nullified during session closure (L164-182)
4. **Auto-Continue Logic**: Sessions with `stopOnEntry=false` automatically continue on entry breakpoints (L230-238)

## Dependencies
- `@debugmcp/shared` - Core types and utilities
- `@vscode/debugprotocol` - DAP protocol definitions
- Various factory interfaces for creating proxy managers and session stores
- Abstracted filesystem, network, and logging interfaces

## Error Handling
Robust error handling with categorized error types (`errorType`, `errorCode`) for machine-readable error identification. Continues operation despite cleanup failures to ensure session closure completes.

## Testing Support
Exposes internal cleanup method for testing via `_testOnly_cleanupProxyEventHandlers()` (L392-394).