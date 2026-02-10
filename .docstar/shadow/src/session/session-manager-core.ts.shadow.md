# src/session/session-manager-core.ts
@source-hash: caf851dfb0eddf00
@generated: 2026-02-09T18:15:24Z

## Purpose
Core session management functionality for debug sessions, providing lifecycle management, state tracking, and event handling coordination between debug adapters and proxy managers.

## Key Classes & Interfaces

### SessionManagerCore (L69-401)
Main class managing debug session lifecycle with dependency injection pattern. Handles session creation, state transitions, proxy event coordination, and cleanup.

**Key Methods:**
- `constructor(config, dependencies)` (L90-113) - Full dependency injection setup with defaults
- `createSession(params)` (L115-124) - Creates new debug session via session store
- `closeSession(sessionId)` (L157-194) - Graceful session shutdown with proxy cleanup
- `closeAllSessions()` (L196-203) - Bulk session termination
- `_updateSessionState(session, newState)` (L134-147) - State transition with legacy mapping
- `setupProxyEventHandlers(session, proxyManager, launchArgs)` (L205-355) - Event handler registration
- `cleanupProxyEventHandlers(session, proxyManager)` (L357-387) - Safe event handler removal

### Interface Definitions
- `CustomLaunchRequestArguments` (L25-29) - Extends VSCode debug protocol with custom fields
- `DebugResult` (L32-41) - Standardized operation result with error metadata
- `SessionManagerDependencies` (L46-55) - Complete dependency injection interface
- `SessionManagerConfig` (L60-64) - Configuration options with defaults

## Key Dependencies
- `@debugmcp/shared` - Session state types and utilities
- `SessionStore` - Session persistence and retrieval
- `IProxyManager` - Debug adapter proxy communication
- VSCode Debug Protocol - Standard debug interface definitions

## Architecture Patterns

### Dependency Injection (L90-113)
Full constructor injection pattern enabling testing and modular design.

### Event-Driven State Management (L205-355)
Proxy manager events drive session state transitions:
- `stopped` → PAUSED (with auto-continue logic for stopOnEntry=false)
- `continued` → RUNNING (with stale event guards)
- `terminated/exited` → STOPPED + cleanup
- `error` → ERROR state

### WeakMap Event Tracking (L84-85)
Uses WeakMap to associate event handlers with sessions for memory-safe cleanup.

### State Synchronization (L134-147)
Maintains both legacy SessionState and new lifecycle/execution state models via `mapLegacyState`.

## Critical Invariants

### Event Handler Lifecycle
- Handlers registered in `setupProxyEventHandlers` must be cleaned up in `cleanupProxyEventHandlers`
- Double cleanup protection via WeakMap existence check (L359-362)
- Continue cleanup even if individual handler removal fails (L373-383)

### Session State Consistency
- State changes always logged and propagated to both legacy and new state models
- Auto-continue only applies for `stopOnEntry=false` and `reason=entry` (L230-238)
- Stale `continued` events ignored if session already PAUSED (L258-263)

### Proxy Manager Lifecycle
- Proxy managers cleaned up before session closure
- Event handlers removed before proxy termination
- Proxy reference cleared after cleanup (`session.proxyManager = undefined`)

## Configuration Defaults
- `logDirBase`: `${tmpdir}/debug-mcp-server/sessions`
- `stopOnEntry`: true, `justMyCode`: true
- `dryRunTimeoutMs`: 10000ms

## Testing Hooks
- `_testOnly_cleanupProxyEventHandlers` (L392-394) - Internal testing access
- Abstract `handleAutoContinue` (L397-400) - To be implemented by subclasses