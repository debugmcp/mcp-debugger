# src/dap-core/state.ts
@source-hash: 5231b1529c13ad2b
@generated: 2026-02-10T00:41:45Z

## Purpose
Pure functional state management for Debug Adapter Protocol (DAP) sessions. Provides immutable state operations for tracking session lifecycle, thread management, and request handling.

## Key Functions

### State Initialization
- `createInitialState(sessionId)` (L9-17): Creates fresh DAP session state with default values - uninitialized, unconfigured adapter, no current thread, empty pending requests Map

### Session Lifecycle Management
- `setInitialized(state, initialized)` (L22-27): Updates session initialization status
- `setAdapterConfigured(state, configured)` (L32-37): Updates debug adapter configuration status  
- `setCurrentThreadId(state, threadId)` (L42-47): Sets active thread ID (number or undefined)

### Request Management
- `addPendingRequest(state, request)` (L52-63): Immutably adds PendingRequest to state's Map, keyed by requestId
- `removePendingRequest(state, requestId)` (L68-79): Immutably removes request from pending Map
- `getPendingRequest(state, requestId)` (L84-89): Retrieves pending request by ID, returns undefined if not found
- `clearPendingRequests(state)` (L94-99): Resets pending requests to empty Map

### Batch Updates
- `updateState(state, updates)` (L104-112): Applies multiple state changes at once, excludes sessionId and pendingRequests from updates object

## Dependencies
- `DAPSessionState`, `PendingRequest` from './types.js' (L4)

## Architectural Patterns
- **Immutability**: All functions return new state objects, never mutate input
- **Pure Functions**: No side effects, predictable outputs for given inputs
- **Map Cloning**: Pending requests Map is defensively copied for immutability
- **Partial Updates**: `updateState` allows batch field updates while protecting core identifiers

## Key Constraints
- sessionId cannot be modified after creation
- pendingRequests Map requires special handling via dedicated functions
- All state mutations must preserve immutability contract