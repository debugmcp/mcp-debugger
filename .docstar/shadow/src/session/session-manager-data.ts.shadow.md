# src/session/session-manager-data.ts
@source-hash: 4d2aa403cb3520b4
@generated: 2026-02-10T01:19:04Z

## Purpose
Data retrieval operations for debug session management, providing methods to fetch variables, stack traces, and scopes from debug adapters with language-specific policy application.

## Core Architecture
Abstract class `SessionManagerData` (L24) extends `SessionManagerCore`, implementing data fetching layer for debug session inspection. Uses adapter policies for language-specific filtering and variable extraction.

## Key Components

### Policy Selection System
- `selectPolicy()` (L28-48): Maps debug language strings/enums to appropriate adapter policies
- Supports: Python, JavaScript, Rust, Go, Mock, with DefaultAdapterPolicy fallback
- Returns policy objects that define language-specific data handling rules

### Core Data Operations
- `getVariables()` (L50-83): Fetches variables by reference ID from debug adapter
  - Validates session state (must be PAUSED) and proxy availability
  - Sends DAP 'variables' request, transforms response to internal Variable format
  - Maps DAP Variable to: {name, value, type, variablesReference, expandable}

- `getStackTrace()` (L85-134): Retrieves call stack with optional filtering
  - Handles threadId resolution (parameter or current session thread)
  - Applies language policy filtering via `policy.filterStackFrames()` (L118-123)
  - Maps DAP StackFrame to: {id, name, file, line, column}

- `getScopes()` (L136-164): Fetches variable scopes for a stack frame
  - Returns raw DebugProtocol.Scope[] without transformation
  - Used by other methods to enumerate variable containers

### High-Level Orchestration
- `getLocalVariables()` (L172-265): Convenience method combining stack/scope/variable operations
  - Multi-step process: stack trace → scopes for all frames → variables for all scopes
  - Delegates to adapter policy's `extractLocalVariables()` for language-specific filtering
  - Returns structured result: {variables, frame, scopeName}
  - Builds comprehensive data maps (scopesMap, variablesMap) for policy consumption

## Dependencies
- Extends `SessionManagerCore` for session management primitives
- Uses `@debugmcp/shared` types: Variable, StackFrame, SessionState, adapter policies
- Communicates via VSCode Debug Adapter Protocol (DebugProtocol types)
- Requires active `proxyManager` for DAP communication

## Error Handling
Consistent pattern across all methods: validates session state → attempts operation → logs and returns empty results on failure. No exceptions propagated to callers.

## Logging
Extensive structured logging with sessionId prefixes for operation tracking and debugging adapter communication.