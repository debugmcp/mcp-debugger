# src/session/session-manager-core.ts
@source-hash: 732cc4e6393abee5
@generated: 2026-02-10T01:19:07Z

## Core Session Management Framework

**Primary Purpose**: Abstract base class providing core session lifecycle management, event handling, and state synchronization for debug sessions. Orchestrates dependency injection and proxy management patterns.

### Key Interfaces & Types

- **CustomLaunchRequestArguments** (L25-28): Extends VSCode debug protocol with `stopOnEntry` and `justMyCode` flags
- **DebugResult** (L31-40): Standardized result interface with machine-readable error types and MCP error codes
- **SessionManagerDependencies** (L45-54): Complete DI container defining all required services (filesystem, network, logging, factories, adapters)
- **SessionManagerConfig** (L59-63): Configuration for logging directories, launch arguments, and timeout settings

### Core Class: SessionManagerCore (L68-400)

**Abstract base class** implementing the foundation of session management with dependency injection pattern.

#### Key Dependencies (L69-84)
- `sessionStore`: Central session registry and state management
- `proxyManagerFactory`: Creates debug adapter proxies
- `adapterRegistry`: Debug adapter discovery and configuration
- `sessionEventHandlers`: WeakMap for memory-safe event handler cleanup

#### Session Lifecycle Methods

- **createSession()** (L114-123): Creates new debug session with language-specific configuration
- **closeSession()** (L156-193): Graceful session termination with proxy cleanup and state transitions to STOPPED/TERMINATED
- **closeAllSessions()** (L195-202): Bulk session cleanup for shutdown scenarios

#### State Management

- **_updateSessionState()** (L133-146): Core state transition logic mapping legacy states to new lifecycle/execution state model using `mapLegacyState()`
- Supports dual state models: legacy `SessionState` and new `SessionLifecycleState`/execution states

#### Event Handler System (L204-394)

**setupProxyEventHandlers()** (L204-354): Establishes named event handlers for debug adapter lifecycle:
- `stopped`: Handles breakpoints, implements auto-continue for `stopOnEntry=false`
- `continued`: Updates to RUNNING state with stale event protection
- `terminated/exited`: Cleanup and state transitions to STOPPED
- `adapter-configured`: Initial adapter setup completion
- `dry-run-complete`: Test execution completion handling
- `error/exit`: Error state management with cleanup

**cleanupProxyEventHandlers()** (L356-386): Memory-safe cleanup with double-cleanup protection and error resilience.

### Architectural Patterns

1. **Dependency Injection**: Constructor takes complete dependency interface, enabling testability
2. **Factory Pattern**: Uses factories for session store and proxy manager creation
3. **Event-Driven**: Proxy lifecycle managed through event handlers with structured logging
4. **State Machine**: Dual state tracking (legacy + new model) with transition validation
5. **WeakMap Cleanup**: Memory leak prevention for event handler management

### Critical Invariants

- Sessions must transition through proper state sequences (CREATED → RUNNING → PAUSED/STOPPED)
- Event handlers must be cleaned up before proxy termination to prevent memory leaks
- `stopOnEntry=false` requires auto-continue implementation in subclasses
- State transitions are logged with structured data for debugging

### Extension Points

- **handleAutoContinue()** (L399): Abstract method requiring subclass implementation for auto-continue behavior

### Dependencies

- `@debugmcp/shared`: Core types and state management utilities
- `@vscode/debugprotocol`: Microsoft DAP protocol definitions
- Factory interfaces for proxy and session store creation
- Platform services: filesystem, network, logging, environment