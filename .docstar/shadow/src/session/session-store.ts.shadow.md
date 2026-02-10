# src/session/session-store.ts
@source-hash: 5a2286b3a68ffcfa
@generated: 2026-02-09T18:15:06Z

## Purpose
Pure data management layer for debug sessions, extracted from SessionManager to improve testability and follow Single Responsibility Principle. Handles session lifecycle, state transitions, and CRUD operations without external dependencies.

## Key Classes & Interfaces

**SessionStore (L63-221)** - Main class managing session lifecycle and state
- Private sessions Map<string, ManagedSession> for storage (L64)
- selectPolicy() (L69-82): Maps DebugLanguage to appropriate AdapterPolicy
- createSession() (L87-126): Creates new session with UUID, validates language, resolves executable path via policy
- get/getOrThrow() (L131-144): Session retrieval with optional error throwing
- update/updateState() (L156-171): Partial updates and state-specific updates with timestamp management
- remove/clear() (L176-220): Cleanup operations

**CreateSessionParams (L28-32)** - Session creation parameters
- language: DebugLanguage (required)
- name?: string (optional, defaults to generated name)
- executablePath?: string (language-agnostic executable path)

**ManagedSession (L48-57)** - Internal session representation extending DebugSessionInfo
- Adds executablePath, proxyManager, breakpoints Map
- Dual state model: sessionLifecycle (SessionLifecycleState) + executionState (ExecutionState)
- toolchainValidation for compatibility checking

**ToolchainValidationState (L36-43)** - Validation result structure
- compatible boolean, toolchain string, optional message/suggestions/behavior/binaryInfo

## Dependencies
- uuid for session ID generation (L8)
- @debugmcp/shared for types and policies (L9-22)
- SessionNotFoundError from local errors (L23)
- IProxyManager interface (L34)

## Key Patterns
- Policy pattern for language-specific adapter selection (L98-99)
- Dual state model: legacy SessionState + new sessionLifecycle/executionState
- Separation of public (DebugSessionInfo) vs internal (ManagedSession) representations
- Immutable session creation with validation
- Automatic timestamp management on updates
- Error-safe retrieval with getOrThrow pattern

## Critical Invariants
- Sessions must have valid DebugLanguage (validated in createSession L93-95)
- updatedAt timestamp automatically updated on any state change
- Session IDs are UUIDs ensuring uniqueness
- Breakpoints stored as Map for efficient lookup by ID