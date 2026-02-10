# src/dap-core/handlers.ts
@source-hash: e31b73d9b6bbc34d
@generated: 2026-02-10T00:41:53Z

## Purpose
Pure message handlers for DAP (Debug Adapter Protocol) communication, providing stateless processing of proxy messages and state transitions for debugging sessions.

## Core Architecture
The file implements a functional message dispatch system with state transformation:
- **Main Entry Point**: `handleProxyMessage` (L25-63) - validates session ID and routes messages by type
- **State Transformation**: Handlers return `DAPProcessingResult` containing commands and optional new state
- **Message Types**: status, error, dapEvent, dapResponse

## Key Functions

### Message Routing
- `handleProxyMessage` (L25-63): Primary dispatcher, validates sessionId and routes to type-specific handlers
- `isValidProxyMessage` (L259-266): Type guard for message validation

### Status Message Handler
- `handleStatusMessage` (L68-135): Processes phase 1 proxy status updates
- **Key Status Types**:
  - `proxy_minimal_ran_ipc_test` (L75-80): IPC validation, kills process
  - `init_received` (L82-87): Initialization acknowledgment
  - `dry_run_complete` (L89-94): Command validation complete
  - `adapter_connected` (L96-101): Transport layer ready, sets initialized state
  - `adapter_configured_and_launched` (L103-118): Full setup complete, handles dual initialization
  - Exit states (L120-131): `adapter_exited`, `dap_connection_closed`, `terminated`

### Error Message Handler
- `handleErrorMessage` (L140-158): Logs and emits error events

### DAP Event Handler
- `handleDapEvent` (L163-228): Phase 2 placeholder, handles debugging events
- **Supported Events**: 
  - `stopped` (L179-192): Updates current thread ID state
  - `continued`, `terminated`, `exited` (L194-216): Basic event forwarding
  - Unknown events forwarded as generic `dap-event` (L218-224)

### DAP Response Handler
- `handleDapResponse` (L233-254): Phase 3 placeholder, matches responses to pending requests
- Currently minimal implementation - removes pending request from state

## Dependencies
- **Types**: Imports DAP protocol types and message interfaces from `./types.js`
- **State Management**: Uses pure state transformation functions from `./state.js` (setInitialized, setAdapterConfigured, setCurrentThreadId, etc.)

## State Management Pattern
Functions are pure - they receive state and return new state via `DAPProcessingResult.newState`. Key state transitions:
- Session initialization tracking (L101, L114-115)
- Adapter configuration status (L110)
- Current debugging thread ID (L185)
- Pending request lifecycle (L252)

## Command Generation
All handlers generate `DAPCommand` arrays for:
- Logging at various levels
- Event emission to external listeners  
- Process control (killProcess)
- State notifications

## Implementation Status
- **Phase 1**: Status/error handling (complete)
- **Phase 2**: DAP event handling (basic implementation)
- **Phase 3**: DAP response handling (placeholder - L248-249 comments indicate future expansion)