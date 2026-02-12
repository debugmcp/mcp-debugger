# src\dap-core/
@generated: 2026-02-12T21:05:46Z

## Purpose
The `dap-core` module provides a functional, stateless architecture for handling Debug Adapter Protocol (DAP) communication. It serves as the central processing layer that transforms proxy messages into actionable commands while maintaining immutable session state, enabling predictable and testable debugging session management.

## Core Architecture

### Functional Message Processing Pipeline
The module follows a pure functional architecture with three distinct phases:

1. **Message Validation & Routing** - Validates incoming proxy messages and routes them to appropriate handlers
2. **State Transformation** - Processes messages and produces new immutable state alongside effect commands  
3. **Command Generation** - Emits structured commands for external execution (logging, client communication, process control)

### Key Components

**Types System (`types.ts`)**
- Defines the foundational contracts with discriminated unions and immutable interfaces
- `DAPSessionState`: Core session state container with readonly properties
- `DAPCommand`: Represents side effects as data (sendToClient, log, emitEvent, killProcess)
- `ProxyMessage` hierarchy: Type-safe message handling for all proxy communication
- `DAPProcessingResult`: Return type coupling commands with optional state changes

**State Management (`state.ts`)**
- Pure functional state operations with immutability guarantees
- Session lifecycle tracking (initialization, adapter configuration)
- Thread management and pending request handling via immutable Maps
- Batch update capabilities while protecting core identifiers

**Message Handlers (`handlers.ts`)**
- Stateless message processors that transform inputs into commands and state
- **Phase 1**: Complete status/error handling for proxy lifecycle management
- **Phase 2**: Basic DAP event processing with thread state tracking
- **Phase 3**: Placeholder DAP response handling for request/response matching

## Public API Surface

### Main Entry Points
- `handleProxyMessage()`: Primary dispatcher for all proxy communication
- State management functions: `createInitialState()`, `setInitialized()`, `setAdapterConfigured()`, etc.
- Complete type system for external integration

### Key Workflows
1. **Session Initialization**: Status message processing drives state transitions from proxy startup through adapter configuration
2. **Event Handling**: DAP debugging events update session state and forward to clients
3. **Request Management**: Pending request lifecycle with immutable tracking

## Internal Organization

### Data Flow Pattern
```
ProxyMessage → handleProxyMessage() → Type-specific handlers → DAPProcessingResult(commands[], newState?)
```

### State Transitions
- Pure functions receive current state and return new state
- No mutations - all changes create new objects
- State changes are coupled with effect commands for external execution

## Design Principles

**Functional Architecture**
- Stateless message processing with pure functions
- Side effects represented as data structures (DAPCommand)
- Immutable state management with defensive copying

**Type Safety**
- Comprehensive TypeScript interfaces with discriminated unions
- Compile-time guarantees for message routing and state management
- Clear separation between core logic and I/O operations

**Extensibility**
- Command-based architecture allows pluggable execution layers
- Phase-based implementation supports incremental feature development
- Generic state update patterns support future enhancements

The module serves as the functional core of a DAP implementation, providing predictable message processing and state management while deferring all side effects to external command executors.