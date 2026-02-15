# src\dap-core/
@children-hash: 14598b37451168bb
@generated: 2026-02-15T09:01:24Z

## Overview
The `dap-core` directory implements a functional, stateless Debug Adapter Protocol (DAP) processing engine. It provides pure functions for handling DAP communication, managing session state, and processing protocol messages without side effects.

## Architecture Pattern
The module follows a strict functional programming approach with clear separation of concerns:

- **Pure State Management**: Immutable state operations with no direct mutations
- **Effect-as-Data**: Side effects are represented as command objects rather than executed directly
- **Stateless Message Processing**: All handlers are pure functions that return commands and new state

## Key Components

### Core Entry Point (`index.ts`)
Barrel export module that provides unified access to all DAP core functionality through three main areas:
- Type definitions and interfaces
- State management utilities  
- Protocol message handlers

### Type System (`types.ts`)
Foundational TypeScript contracts defining:
- **DAPSessionState**: Immutable session state container with initialization status, adapter configuration, thread tracking, and pending requests
- **DAPCommand**: Discriminated union representing all possible side effects (logging, client communication, process control, event emission)
- **ProxyMessage Types**: Complete message protocol for proxy communication including status updates, DAP events, responses, and errors
- **DAPProcessingResult**: Standard return type pairing command arrays with optional new state

### State Management (`state.ts`)
Pure functional state operations providing:
- Session lifecycle management (initialization, adapter configuration)
- Thread tracking for debugging context
- Immutable request management with Map-based pending request tracking
- Batch state updates while preserving immutability guarantees

### Message Handlers (`handlers.ts`)
Stateless message processing engine with:
- **Primary Dispatcher**: `handleProxyMessage` validates sessions and routes by message type
- **Status Handler**: Manages proxy lifecycle transitions from IPC validation through adapter connection and termination
- **Event Handler**: Processes DAP debugging events (stopped, continued, terminated) with thread state updates
- **Response Handler**: Matches DAP responses to pending requests and manages request lifecycle
- **Error Handler**: Standardized error processing and event emission

## Public API Surface

### Main Entry Points
- `handleProxyMessage(message, state)`: Primary message processor returning commands and new state
- `createInitialState(sessionId)`: Factory for new session state
- State mutation functions: `setInitialized`, `setAdapterConfigured`, `setCurrentThreadId`, etc.

### Message Processing Flow
1. **Validation**: Session ID validation and message type checking
2. **Routing**: Type-specific handler dispatch  
3. **Processing**: Pure state transformation and command generation
4. **Result**: Returns both effects (commands) and new state

## Data Flow
The module operates as a pure transformation pipeline:
```
ProxyMessage + DAPSessionState → [DAPCommand] + NewState
```

This design enables:
- **Testability**: All functions are deterministic and side-effect free
- **Composability**: Handlers can be combined and extended easily
- **Predictability**: State changes are explicit and traceable
- **Integration**: Effect commands can be executed by external systems

## Integration Pattern
External consumers receive command arrays representing desired side effects (logging, network communication, process control) while the core remains purely functional. This separation allows the core logic to be thoroughly tested while delegation execution concerns to appropriate subsystems.