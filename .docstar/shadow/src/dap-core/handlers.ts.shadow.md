# src/dap-core/handlers.ts
@source-hash: e31b73d9b6bbc34d
@generated: 2026-02-09T18:15:01Z

## Purpose
Pure functional message handlers for Debug Adapter Protocol (DAP) proxy messages. Implements stateless processing that transforms incoming proxy messages into command lists and state updates.

## Architecture
Follows functional programming pattern with immutable state transformations. Main dispatcher delegates to specialized handlers based on message type.

## Key Functions

### handleProxyMessage (L25-63)
Main message dispatcher that validates session ID and routes messages to appropriate handlers. Returns DAPProcessingResult with commands and optional state updates.

### handleStatusMessage (L68-135)
Processes proxy lifecycle status messages including:
- `adapter_connected` (L96-101): Sets initialized state and emits event
- `adapter_configured_and_launched` (L103-118): Updates adapter state with conditional initialization
- Exit conditions (L120-131): Handles adapter termination scenarios

### handleErrorMessage (L140-158)
Simple error handler that logs proxy errors and emits error events.

### handleDapEvent (L163-228)
Processes DAP debugging events with state tracking:
- `stopped` event (L179-192): Extracts threadId and updates current thread state
- Standard DAP events (continued, terminated, exited) forwarded as events
- Unknown events forwarded as generic 'dap-event'

### handleDapResponse (L233-254)
Placeholder for Phase 3 implementation. Currently validates pending requests and removes them from state.

### isValidProxyMessage (L259-266)
Type guard validating message structure with sessionId and type fields.

## Dependencies
- State management functions from './state.js' for immutable state updates
- Type definitions from './types.js' for all message and state types

## State Management Pattern
Functions never mutate input state directly. State updates use helper functions (setInitialized, setAdapterConfigured, etc.) that return new state objects.

## Command Pattern
All handlers return DAPCommand arrays for external systems to execute (logging, events, process management).

## Development Status
- Phase 1: Status and error handling (complete)
- Phase 2: DAP event handling (basic implementation)  
- Phase 3: DAP response handling (placeholder)