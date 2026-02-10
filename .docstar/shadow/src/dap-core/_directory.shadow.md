# src/dap-core/
@generated: 2026-02-10T01:19:43Z

## Overall Purpose
The `dap-core` module provides a functional, stateless implementation of Debug Adapter Protocol (DAP) message processing and session management. It serves as the core computational engine for handling DAP communication between debug clients, proxies, and debug adapters using pure functional programming principles.

## Architecture Pattern
The module follows a strict functional architecture with clear separation of concerns:
- **Pure State Management**: Immutable state transformations without side effects
- **Command-Based Side Effects**: All I/O operations represented as data structures (`DAPCommand`)
- **Message Dispatch**: Type-safe routing and processing of proxy messages
- **Effect-State Separation**: Processing functions return both commands to execute and new state

## Key Components and Relationships

### Core State Management (`state.ts`)
Provides pure functions for managing `DAPSessionState`:
- Session initialization and configuration tracking
- Debug thread management  
- Pending request lifecycle
- Immutable state transformations with defensive copying

### Message Handlers (`handlers.ts`)
Stateless message processors that transform proxy messages into commands and state updates:
- **Primary Entry**: `handleProxyMessage` - validates and routes all incoming messages
- **Status Handler**: Manages proxy lifecycle events (initialization, adapter setup, termination)
- **Event Handler**: Processes DAP debugging events (breakpoints, execution control)
- **Response Handler**: Matches DAP responses to pending requests
- **Error Handler**: Processes and logs error conditions

### Type System (`types.ts`)
Defines the complete contract layer:
- **State Types**: `DAPSessionState`, `PendingRequest` for session management
- **Command Types**: `DAPCommand` union for representing side effects as data
- **Message Types**: `ProxyMessage` hierarchy for type-safe communication
- **Result Types**: `DAPProcessingResult` for handler return values

## Public API Surface

### Main Entry Points
- **`handleProxyMessage`**: Primary message processor - validates session and routes by message type
- **State Management Functions**: `createInitialState`, `setInitialized`, `setAdapterConfigured`, `setCurrentThreadId`, etc.
- **Type Exports**: Complete TypeScript interface definitions for consumers

### Integration Pattern
1. **Initialize**: Create session state with `createInitialState(sessionId)`
2. **Process**: Call `handleProxyMessage(message, currentState)` 
3. **Execute**: Process returned `DAPCommand[]` array (logging, client communication, etc.)
4. **Update**: Apply `newState` if provided in result

## Internal Organization and Data Flow

### Message Processing Pipeline
```
ProxyMessage → validateSession → routeByType → specificHandler → DAPProcessingResult
```

### State Evolution
Session state progresses through defined phases:
- **Phase 1**: Proxy status handling (initialization, adapter setup)
- **Phase 2**: DAP event processing (debugging lifecycle)
- **Phase 3**: DAP response correlation (request/response matching)

### Effect Handling
All side effects are represented as `DAPCommand` data structures:
- `sendToClient`/`sendToProxy`: Communication commands
- `log`: Structured logging with levels
- `emitEvent`: Custom event emission
- `killProcess`: Process control

## Important Patterns and Conventions

### Functional Purity
- All functions are pure - no direct side effects or mutations
- State transformations return new objects, never modify inputs
- Side effects represented as returnable command data structures

### Immutability
- State uses `readonly` properties and `ReadonlyMap` for collections
- Defensive copying in state management functions
- Session ID is immutable after creation

### Type Safety
- Discriminated unions for message and command types
- Type guards for message validation
- Explicit handling of all message variants

### Error Handling
- Graceful degradation with logging for unknown message types
- Session validation prevents processing invalid messages
- Clear error propagation through command system

This module enables predictable, testable DAP session management by isolating pure computational logic from I/O operations and providing a clear functional interface for DAP protocol handling.