# tests/unit/dap-core/handlers.test.ts
@source-hash: 3b13c2962afc3480
@generated: 2026-02-10T00:41:38Z

## Purpose
Unit test suite for DAP (Debug Adapter Protocol) core message handlers, validating proxy message processing logic and state management for debug session communication.

## Test Structure

### Main Test Suite: `DAP Core Handlers` (L16-383)
Comprehensive test coverage for the DAP core module's message handling capabilities.

### Core Function Tests: `handleProxyMessage` (L17-348)
Tests the primary message handler function with multiple scenarios:

**Session Validation** (L24-42)
- Tests session ID mismatch rejection (L25-41)
- Validates warning command generation for invalid sessions

**Status Messages - Phase 1** (L44-186)
- `proxy_minimal_ran_ipc_test`: IPC test completion handling (L45-65)
- `dry_run_complete`: Dry run completion with command/script emission (L67-89)
- `adapter_configured_and_launched`: Adapter launch handling with state transitions (L91-137)
  - Tests both uninitialized (L91-120) and already initialized states (L122-137)
- Adapter exit statuses: `adapter_exited`, `dap_connection_closed`, `terminated` (L139-169)
- Default exit code handling when missing (L171-185)

**Error Messages - Phase 1** (L188-211)
- Error message processing with event emission (L189-210)

**DAP Events - Phase 2** (L213-327)
- `stopped` event: Thread ID tracking and state updates (L214-259)
- `continued`, `terminated`, `exited` events: Standard DAP event forwarding (L261-309)
- Unknown DAP events: Generic forwarding mechanism (L311-326)

**Unknown Message Types** (L329-347)
- Warning generation for unsupported message types (L330-346)

### Validation Function Tests: `isValidProxyMessage` (L350-382)
Tests message structure validation:
- Valid message format validation (L351-362)
- Invalid message rejection (L364-381)

## Key Dependencies
- **Vitest**: Testing framework (L4)
- **DAP Core Module**: Main functionality under test (L5-14)
  - `handleProxyMessage`: Primary message processor
  - `isValidProxyMessage`: Message validator
  - `createInitialState`: State factory
  - Type definitions: `DAPSessionState`, `ProxyMessage`, `ProxyStatusMessage`, `ProxyErrorMessage`, `ProxyDapEventMessage`

## Test Patterns
- **State Management**: Each test uses fresh state via `beforeEach` (L20-22)
- **Message Structure**: Consistent proxy message format validation
- **Command Verification**: Thorough validation of generated commands (logging, events, process control)
- **State Transitions**: Verification of session state updates
- **Event Emission**: Testing of debug adapter event forwarding

## Critical Behaviors Tested
- Session ID validation and mismatch handling
- Debug adapter lifecycle event processing
- Thread tracking for debugging sessions
- Error propagation and logging
- State persistence across message handling
- Command generation for downstream consumers