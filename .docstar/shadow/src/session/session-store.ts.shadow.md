# src/session/session-store.ts
@source-hash: 5a2286b3a68ffcfa
@generated: 2026-02-10T00:41:57Z

## Primary Purpose
Pure data management layer for debug sessions, providing stateful storage and lifecycle management without external dependencies. Extracted from SessionManager to improve testability and follow Single Responsibility Principle.

## Key Interfaces & Types

**CreateSessionParams (L28-32)**: Input parameters for session creation with language, optional name, and executable path.

**ToolchainValidationState (L36-43)**: Validation metadata for toolchain compatibility including compatibility flag, toolchain info, messages, and binary details.

**ManagedSession (L48-57)**: Extended session representation inheriting from DebugSessionInfo, adding internal fields like proxyManager, breakpoints Map, sessionLifecycle state, executionState, logDir, and toolchainValidation.

## Core Class: SessionStore (L63-221)

**Storage**: Uses private Map<string, ManagedSession> for in-memory session storage (L64).

### Key Methods

**selectPolicy() (L69-82)**: Maps DebugLanguage enum to appropriate AdapterPolicy implementations (Python, JavaScript, Rust, Mock, or Default).

**createSession() (L87-126)**: 
- Generates UUID for session ID
- Validates language against DebugLanguage enum
- Uses adapter policy to resolve executable path
- Initializes ManagedSession with dual state model (legacy SessionState + new SessionLifecycleState)
- Returns public DebugSessionInfo interface

**Session Retrieval**:
- get() (L131-133): Safe retrieval returning undefined if not found
- getOrThrow() (L138-144): Throws SessionNotFoundError for missing sessions
- set() (L149-151): Direct session injection (testing utility)

**State Management**:
- update() (L156-160): Partial updates with automatic updatedAt timestamp
- updateState() (L165-171): Targeted state updates with change detection
- remove() (L176-178): Session deletion

**Collection Operations**:
- getAll() (L183-192): Returns public DebugSessionInfo array (filtered view)
- getAllManaged() (L197-199): Returns full ManagedSession array (internal view)
- has() (L204-206): Existence check
- size() (L211-213): Count sessions
- clear() (L218-220): Bulk deletion

## Dependencies

**External**: uuid for session ID generation, @debugmcp/shared for types and adapter policies, SessionNotFoundError from local errors module.

**Type Dependencies**: IProxyManager interface from proxy module (L34).

## Architectural Patterns

**State Model Transition**: Supports dual state tracking (legacy SessionState + new SessionLifecycleState/ExecutionState) indicating ongoing migration.

**Policy Pattern**: Language-specific behavior delegation through AdapterPolicy selection.

**Data Access Layer**: Pure storage operations without business logic, enabling easy testing and composition.

**Interface Segregation**: Exposes minimal public interface (DebugSessionInfo) while maintaining rich internal representation (ManagedSession).

## Critical Invariants

- Session IDs are UUID-based and unique
- updatedAt timestamp maintained on all mutations
- Language validation against DebugLanguage enum on creation
- Breakpoints stored as Map for efficient lookups
- Sessions can exist in memory without external resources (proxy managers are optional)