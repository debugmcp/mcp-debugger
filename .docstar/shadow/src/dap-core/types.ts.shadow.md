# src/dap-core/types.ts
@source-hash: 5a4591c3cd7ab33d
@generated: 2026-02-10T00:41:50Z

## Core Types for Functional DAP Handling

This file defines the foundational TypeScript interfaces and types for a Debug Adapter Protocol (DAP) implementation using a functional programming approach. It serves as the contract layer between the core functional logic and the external DAP ecosystem.

### Key Type Definitions

**PendingRequest (L9-14)**: Pure data interface representing a pending DAP request without timeout logic. Contains essential tracking fields: requestId, command, seq number, and timestamp.

**DAPSessionState (L19-26)**: Immutable state container for a DAP debugging session. Tracks initialization status, adapter configuration, current thread ID, and pending requests via ReadonlyMap. Designed for functional state management patterns.

**DAPCommand (L31-36)**: Discriminated union representing commands that the functional core emits but doesn't execute directly. Includes:
- `sendToClient`: For DAP responses/events to client
- `sendToProxy`: For commands to proxy layer  
- `log`: For structured logging with levels
- `emitEvent`: For custom event emission
- `killProcess`: For process termination

**DAPProcessingResult (L41-44)**: Return type for DAP message processing functions. Contains array of commands to execute and optional new state, enabling pure functional message handling.

### Proxy Communication Types

**ProxyStatusMessage (L49-55)**: Comprehensive union type covering all proxy lifecycle states including initialization, dry runs, adapter connection/configuration, and termination scenarios with exit codes and signals.

**ProxyDapEventMessage (L57-63)**: Wraps DAP events from proxy with session context and optional metadata.

**ProxyDapResponseMessage (L65-74)**: Handles DAP response messages with success/failure states, response bodies, and error information.

**ProxyErrorMessage (L76-81)**: Simple error message wrapper with session context.

**ProxyMessage (L83)**: Top-level union of all proxy message types for type-safe message handling.

### Architecture Pattern

The types follow a functional architecture where:
- State is immutable (readonly properties, ReadonlyMap)
- Side effects are represented as data (DAPCommand)
- Message processing returns both effects and new state
- Clear separation between core logic and I/O operations

This design enables testable, predictable DAP session management with explicit effect handling.