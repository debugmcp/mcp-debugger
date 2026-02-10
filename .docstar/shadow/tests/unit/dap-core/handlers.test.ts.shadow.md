# tests/unit/dap-core/handlers.test.ts
@source-hash: 3b13c2962afc3480
@generated: 2026-02-09T18:14:47Z

## Purpose
Unit test suite for DAP (Debug Adapter Protocol) core message handlers, validating proxy message processing logic and state management for debugging sessions.

## Test Structure

### Main Test Suite: DAP Core Handlers (L16-383)
Tests the core message handling functionality with comprehensive coverage of different message types and scenarios.

#### handleProxyMessage Tests (L17-348)
Primary test group validating the `handleProxyMessage` function behavior:

**Setup & Session Validation (L18-42)**
- `beforeEach` creates fresh `DAPSessionState` with test session ID (L20-22)
- Tests session ID mismatch rejection with warning log (L25-41)

**Phase 1: Status Messages (L44-186)**
- `proxy_minimal_ran_ipc_test`: IPC test completion handling (L45-65)
- `dry_run_complete`: Dry run completion with command/script emission (L67-89)
- `adapter_configured_and_launched`: Adapter launch handling with initialization state tracking (L91-137)
- Exit status handling: `adapter_exited`, `dap_connection_closed`, `terminated` (L139-185)

**Phase 1: Error Messages (L188-211)**
- Error message processing with logging and event emission (L189-210)

**Phase 2: DAP Events (L213-327)**
- `stopped` event: Thread ID tracking and state updates (L214-259)
- `continued`, `terminated`, `exited` events: Standard DAP event forwarding (L261-309)
- Unknown DAP event forwarding as generic `dap-event` (L311-326)

**Unknown Message Handling (L329-347)**
- Warning logs for unrecognized message types (L330-346)

#### isValidProxyMessage Tests (L350-382)
Validates message structure and type checking:
- Valid message format validation (L351-362)
- Invalid message rejection (null, undefined, missing fields, wrong types) (L364-381)

## Key Dependencies
- **vitest**: Testing framework (describe, it, expect, beforeEach) (L4)
- **dap-core/index.js**: Core DAP functionality including handlers, validators, state management, and type definitions (L5-14)

## Test Patterns
- Comprehensive message type coverage (status, error, dapEvent, unknown)
- State mutation validation through `result.newState` assertions
- Command generation verification (log, emitEvent, killProcess types)
- Error condition handling (session mismatches, malformed data)
- Event forwarding validation with proper argument transformation

## Critical Behaviors Tested
- Session ID validation prevents cross-session message processing
- State transitions for initialization and adapter configuration
- Thread ID tracking for debugging session management
- Proper event emission for different DAP lifecycle phases
- Graceful handling of unknown/malformed messages