# src/dap-core/
@generated: 2026-02-10T21:26:20Z

## Overall Purpose
The `dap-core` module provides a functional, stateless architecture for handling Debug Adapter Protocol (DAP) communication. It serves as the core processing engine for debugging sessions, implementing pure functional patterns for message handling, state management, and command generation without direct side effects.

## Architecture Overview
The module follows a clean functional architecture with three primary layers:

**Types Layer** (`types.ts`): Defines the foundational contracts including immutable state structures, command representations, and proxy message types. Uses discriminated unions and readonly properties to enforce immutability.

**State Management Layer** (`state.ts`): Provides pure functions for DAP session state transitions. All operations are immutable transformations that return new state objects, supporting session lifecycle, thread management, and pending request tracking.

**Message Processing Layer** (`handlers.ts`): Implements stateless message handlers that process proxy messages and return both commands and state changes. Handles the complete DAP lifecycle from initialization through debugging events.

## Key Components and Data Flow

### Core Processing Pipeline
1. **Message Validation**: `handleProxyMessage` validates incoming proxy messages and routes by type
2. **State Transformation**: Type-specific handlers process messages and return `DAPProcessingResult` 
3. **Command Generation**: Handlers emit `DAPCommand` arrays for logging, events, and I/O operations
4. **State Updates**: Pure state functions apply immutable transformations

### State Management Pattern
- **Immutable State**: `DAPSessionState` tracks initialization, adapter status, current thread, and pending requests
- **Pure Functions**: All state operations in `state.ts` are side-effect free transformations
- **Batch Updates**: `updateState` allows multiple field changes while preserving immutability

### Message Handler Types
- **Status Messages**: Handle proxy lifecycle events (initialization, configuration, termination)
- **Error Messages**: Process and emit error events
- **DAP Events**: Forward debugging events (stopped, continued, terminated) 
- **DAP Responses**: Match responses to pending requests

## Public API Surface

### Main Entry Points
- **`handleProxyMessage`**: Primary message processor accepting any `ProxyMessage`
- **State Management Functions**: `createInitialState`, `setInitialized`, `setAdapterConfigured`, `setCurrentThreadId`
- **Request Management**: `addPendingRequest`, `removePendingRequest`, `getPendingRequest`, `clearPendingRequests`

### Key Types
- **`DAPSessionState`**: Immutable session state container
- **`DAPCommand`**: Effect representation for external actions
- **`DAPProcessingResult`**: Handler return type with commands and optional state
- **`ProxyMessage`**: Union of all supported proxy message types

### Export Structure
The `index.ts` serves as a barrel export, providing unified access to:
- All type definitions from `types.js`
- State management utilities from `state.js`
- Message handlers from `handlers.js`

## Internal Organization

### Effect System
The module uses a command pattern where handlers generate `DAPCommand` arrays instead of performing side effects directly. Commands include:
- `sendToClient`/`sendToProxy` for communication
- `log` for structured logging
- `emitEvent` for custom events
- `killProcess` for process control

### Implementation Status
- **Phase 1**: Status and error handling (complete)
- **Phase 2**: DAP event handling (basic implementation)  
- **Phase 3**: DAP response handling (placeholder for future expansion)

## Important Patterns
- **Functional Purity**: All core functions are pure with no side effects
- **Immutable State**: Defensive copying and readonly properties throughout
- **Type Safety**: Extensive use of discriminated unions and type guards
- **Command-Query Separation**: Clear separation between state queries and mutations
- **Effect-as-Data**: Side effects represented as command data structures

This architecture enables predictable, testable DAP session management with explicit control over side effects and clear separation of concerns.