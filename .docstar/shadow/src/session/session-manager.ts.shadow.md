# src/session/session-manager.ts
@source-hash: b8ac34c9b165c438
@generated: 2026-02-10T01:18:52Z

## Purpose
Main entry point for debug session management that composes all session management functionality through inheritance. Acts as a facade that re-exports types and delegates core operations to SessionManagerOperations.

## Architecture
- **SessionManager (L28)**: Main class extending SessionManagerOperations to provide complete session management interface
- **Re-exports (L13-23)**: Convenience exports for types from session-manager-core.js and session-manager-operations.js
- **Composition Pattern**: Uses inheritance from SessionManagerOperations rather than composition

## Key Components
- **handleAutoContinue() (L36-38)**: Placeholder method that throws error - awaits refactoring to accept sessionId parameter
- **Type Re-exports (L13-20)**: SessionManagerDependencies, SessionManagerConfig, CustomLaunchRequestArguments, DebugResult, EvaluateResult

## Dependencies
- `./session-manager-operations.js` - Core operations implementation
- Indirectly depends on `./session-manager-core.js` via re-exports

## Design Notes
- Each debug session gets its own ProxyManager for process/DAP communication isolation
- SessionManager is designed as main composition point but currently minimal implementation
- Architecture suggests separation of concerns with core types, operations, and main manager class