# src/dap-core/types.ts
@source-hash: 5a4591c3cd7ab33d
@generated: 2026-02-09T18:15:04Z

## Primary Purpose

Core type definitions for a functional Debug Adapter Protocol (DAP) handling system. This file establishes the data structures and message types for stateless DAP session management, command emission, and proxy communication.

## Key Types and Interfaces

### Core Data Structures

- **PendingRequest (L9-14)**: Immutable data structure tracking pending DAP requests with requestId, command, sequence number, and timestamp. Pure data with no timeout logic.

- **DAPSessionState (L18-26)**: Immutable state representation for a DAP session containing sessionId, initialization flags (initialized, adapterConfigured), optional currentThreadId, and a readonly map of pending requests. Designed for functional state management.

### Command System

- **DAPCommand (L31-36)**: Discriminated union defining commands the functional core can emit but not execute:
  - `sendToClient`: Send DAP Response/Event to debug client
  - `sendToProxy`: Send command to proxy process
  - `log`: Emit log message with level and data
  - `emitEvent`: Emit event with arguments
  - `killProcess`: Terminate process command

- **DAPProcessingResult (L41-44)**: Result of DAP message processing containing array of commands to execute and optional new state.

### Proxy Communication Types

- **ProxyStatusMessage (L49-55)**: Status updates from proxy including lifecycle events like `proxy_minimal_ran_ipc_test`, `init_received`, `dry_run_complete`, `adapter_connected`, `adapter_configured_and_launched`, and termination statuses.

- **ProxyDapEventMessage (L57-63)**: DAP events forwarded from proxy with sessionId, event name, and optional body/data.

- **ProxyDapResponseMessage (L65-74)**: DAP responses from proxy including success flag, optional response object, error message, and additional data.

- **ProxyErrorMessage (L76-81)**: Error messages from proxy with sessionId and error details.

- **ProxyMessage (L83)**: Union type encompassing all proxy message types.

## Dependencies

- `@vscode/debugprotocol`: Standard DAP protocol types for Response and Event objects
- Node.js types: Uses `NodeJS.Signals` for process signal handling

## Architectural Patterns

- **Immutability**: All interfaces use `readonly` modifiers to enforce functional programming patterns
- **Discriminated Unions**: Extensive use of type-safe discriminated unions for message handling
- **Command Pattern**: Commands are data structures that describe actions without executing them
- **Functional State Management**: State updates return new state objects rather than mutating existing ones

## Key Design Decisions

- Separation of command description from execution (functional core emits, external system executes)
- Immutable state management for predictable debugging and testing
- Comprehensive proxy message typing to match existing ProxyManager implementation
- Pure data structures without embedded behavior or timeout logic