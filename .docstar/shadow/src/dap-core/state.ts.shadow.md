# src/dap-core/state.ts
@source-hash: 5231b1529c13ad2b
@generated: 2026-02-09T18:15:01Z

## Primary Purpose
Pure functional state management module for Debug Adapter Protocol (DAP) sessions. Provides immutable state operations following functional programming patterns with no side effects.

## Key Functions

### State Creation
- **createInitialState** (L9-17): Factory function creating fresh DAP session state with sessionId, initialization flags, thread tracking, and empty pending requests Map

### Session Lifecycle Management  
- **setInitialized** (L22-27): Immutably updates session initialization status
- **setAdapterConfigured** (L32-37): Immutably updates adapter configuration status  
- **setCurrentThreadId** (L42-47): Immutably updates active thread ID (number or undefined)

### Pending Request Management
- **addPendingRequest** (L52-63): Adds new pending request to cloned Map, avoiding mutation
- **removePendingRequest** (L68-79): Removes request by ID from cloned Map
- **getPendingRequest** (L84-89): Read-only lookup of pending request by ID
- **clearPendingRequests** (L94-99): Resets pending requests to empty Map

### Bulk Operations
- **updateState** (L104-112): Applies multiple state changes at once, excluding sessionId and pendingRequests from updates via Omit utility type

## Dependencies
- `DAPSessionState, PendingRequest` from './types.js' - Core type definitions for session state structure

## Architectural Patterns
- **Immutable Updates**: All state mutations return new objects using spread operator
- **Map Cloning**: Pending requests Map is defensively copied before modification to prevent shared references
- **Pure Functions**: No side effects, deterministic outputs based solely on inputs
- **TypeScript Safety**: Leverages Partial and Omit utility types for type-safe bulk updates

## Critical Invariants
- Session ID is immutable after creation (protected in updateState)
- Pending requests Map structure is preserved through defensive copying
- All functions return new state objects, never mutate input state