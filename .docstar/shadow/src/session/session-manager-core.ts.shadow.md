# src/session/session-manager-core.ts
@source-hash: 70f29bed80f741b2
@generated: 2026-02-11T16:12:58Z

## SessionManagerCore

**Primary Purpose**: Abstract base class providing core session management functionality for debug sessions, including lifecycle management, state transitions, proxy event handling, and dependency injection architecture.

### Key Interfaces & Types

**CustomLaunchRequestArguments (L25-28)**: Extends VSCode debug protocol with custom launch options (`stopOnEntry`, `justMyCode`)

**DebugResult (L31-40)**: Standardized response interface with success/error states, machine-readable error types, and continuation flags

**SessionManagerDependencies (L45-54)**: Complete dependency injection container including file system, networking, logging, proxy management, and debug target launching

**SessionManagerConfig (L59-63)**: Configuration options for log directories, default launch arguments, and timeout settings

### Core Class: SessionManagerCore (L68-400)

**Architecture**: Abstract class using dependency injection pattern with factory methods for creating session stores and proxy managers

**Key Protected Dependencies**:
- `sessionStore` (L69): Central session storage and retrieval
- `proxyManagerFactory` (L75): Creates proxy managers for debug adapter communication
- `sessionEventHandlers` (L84): WeakMap tracking event listeners for cleanup

**Constructor (L89-112)**: Initializes all dependencies, creates session store, sets up log directories with fallback to temp directory

### Session Lifecycle Methods

**createSession (L114-123)**: Creates new debug sessions with language, name, and executable path parameters

**closeSession (L156-193)**: Comprehensive session teardown including proxy cleanup, event handler removal, and state transitions to STOPPED/TERMINATED

**closeAllSessions (L195-202)**: Bulk session cleanup iterating over all managed sessions

### State Management

**_updateSessionState (L133-146)**: Centralizes state transitions with logging and dual state model support (legacy + new lifecycle states)

**Session States**: Manages transitions between CREATED → RUNNING → PAUSED → STOPPED/ERROR states

### Event Handling System (L204-400)

**setupProxyEventHandlers (L204-354)**: Establishes comprehensive event listener system for debug proxy events:
- `stopped`: Handles breakpoints, entry points, auto-continue logic (L213-241)
- `continued`: Manages execution resumption with stale event guards (L243-267)
- `terminated/exited`: Session cleanup and state transitions (L270-299)
- `adapter-configured`: Initial setup completion (L302-311)
- `dry-run-complete`: Test execution completion (L313-325)
- `error/exit`: Error handling and cleanup (L327-349)

**cleanupProxyEventHandlers (L356-386)**: Safe event listener removal with error handling and WeakMap cleanup

### Key Patterns

**Dependency Injection**: Full constructor injection with interface-based dependencies

**Event-Driven Architecture**: Proxy managers emit events handled by session manager for state synchronization

**Error Resilience**: Comprehensive error handling in cleanup operations with continuation on failure

**Dual State Model**: Supports both legacy SessionState and new SessionLifecycleState/ExecutionState

**Auto-Continue Logic**: Handles `stopOnEntry=false` scenarios with automatic execution resumption

### Abstract Methods

**handleAutoContinue (L399)**: Must be implemented by subclasses to provide continue operation functionality

### Critical Invariants

- Event handlers must be cleaned up before proxy termination to prevent memory leaks
- State transitions are logged and synchronized between legacy and new state models  
- WeakMap usage prevents memory leaks from stale session references
- Session store factory pattern enables testability and different storage backends