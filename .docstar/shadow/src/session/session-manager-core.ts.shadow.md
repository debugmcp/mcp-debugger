# src\session\session-manager-core.ts
@source-hash: 1b9b667a88344c97
@generated: 2026-02-23T15:26:04Z

**Purpose:** Core session management functionality providing the foundational abstract base class for debug session lifecycle, state management, and proxy event handling.

**Primary Components:**

- `SessionManagerCore` (L68-406): Abstract base class for session management with complete dependency injection support
- `CustomLaunchRequestArguments` (L25-28): Extension of VSCode Debug Protocol launch args with stopOnEntry and justMyCode flags
- `DebugResult` (L31-40): Standardized result interface with success/error states and machine-readable error types
- `SessionManagerDependencies` (L45-54): Comprehensive DI container interface
- `SessionManagerConfig` (L59-63): Configuration options for log directory, launch args, and timeouts

**Key Methods:**

- `createSession()` (L114-123): Creates new debug session with language/name/path parameters
- `closeSession()` (L156-194): Safely terminates session with proxy cleanup and state updates
- `closeAllSessions()` (L196-203): Bulk session termination
- `setupProxyEventHandlers()` (L205-360): Registers comprehensive event handlers for proxy lifecycle events
- `cleanupProxyEventHandlers()` (L362-392): Safe removal of event listeners with error handling

**Event Handler Architecture:**
The class manages proxy lifecycle through named event handlers for:
- `stopped` (L214-239): Handles breakpoint pauses with auto-continue logic
- `continued` (L244-266): State transitions with stale event guards
- `terminated/exited` (L271-300): Session cleanup
- `adapter-configured` (L303-311): Initial state setup
- `dry-run-complete` (L314-325): Test execution completion
- `error/exit` (L328-355): Error handling and cleanup

**Dependencies:**
Integrates with FileSystem, NetworkManager, Logger, ProxyManagerFactory, SessionStoreFactory, DebugTargetLauncher, Environment, and AdapterRegistry through clean DI pattern.

**State Management:**
Uses dual state model - legacy `SessionState` and new `SessionLifecycleState`/`ExecutionState` with automatic mapping via `mapLegacyState()`.

**Memory Management:**
Uses WeakMap (L84) for event handler tracking to prevent memory leaks and enable safe cleanup.

**Abstract Requirements:**
Subclasses must implement `handleAutoContinue()` (L405) for stopOnEntry=false behavior.

**Architectural Notes:**
- Factory-based creation for testability
- Comprehensive error handling with structured logging
- Event-driven architecture with proper cleanup patterns
- Thread-safe event handler management