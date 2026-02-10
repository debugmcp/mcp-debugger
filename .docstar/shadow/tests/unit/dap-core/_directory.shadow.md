# tests/unit/dap-core/
@generated: 2026-02-09T18:16:09Z

## Overall Purpose

The `tests/unit/dap-core` directory contains comprehensive unit tests for the DAP (Debug Adapter Protocol) core module, focusing on two critical components: message handling and state management. This test suite validates the foundational logic for processing DAP protocol messages and maintaining debugging session state in an immutable, thread-safe manner.

## Key Components and Relationships

### Message Handling Tests (`handlers.test.ts`)
Tests the core message processing pipeline that handles various DAP protocol communications:
- **Proxy Message Processing**: Validates `handleProxyMessage` function for routing and processing different message types
- **Message Validation**: Tests `isValidProxyMessage` for structural message verification
- **Session Management**: Ensures proper session ID validation and isolation between debugging sessions

### State Management Tests (`state.test.ts`)
Tests the immutable state management system that tracks debugging session state:
- **State Creation**: Tests `createInitialState` for proper session initialization
- **State Mutations**: Validates state update functions (`setInitialized`, `setAdapterConfigured`, `setCurrentThreadId`)
- **Request Tracking**: Tests pending request queue management (add, get, remove, clear operations)
- **Batch Updates**: Tests `updateState` for atomic multi-property updates

## Test Coverage and Architecture

### Message Processing Flow
The handlers tests validate a complete message processing pipeline:
1. **Session Validation**: Ensures messages belong to correct debugging session
2. **Phase-based Processing**: 
   - Phase 1: Status and error messages (IPC tests, dry runs, adapter lifecycle)
   - Phase 2: DAP events (stopped, continued, terminated, exited)
3. **State Updates**: Verifies proper state mutations and command generation
4. **Event Forwarding**: Tests proper DAP event propagation to consumers

### State Management Patterns
The state tests validate functional programming patterns:
- **Immutability**: Rigorous testing ensures original state objects never mutate
- **Session Isolation**: State tied to specific session IDs preventing cross-contamination
- **Thread Management**: Optional thread ID tracking for debugging context
- **Request Queue**: Map-based pending request storage with full CRUD operations

## Critical Quality Assurance

### Immutability Guarantees
Both test suites extensively validate that state operations never mutate original objects, ensuring predictable behavior in concurrent debugging scenarios.

### Error Handling Coverage
- Malformed message rejection
- Session ID mismatches
- Unknown message types
- Invalid state transitions

### Integration Points
The tests validate key integration touchpoints:
- **Command Generation**: Tests verify proper command emission (log, emitEvent, killProcess)
- **Event System**: Validates DAP event forwarding and transformation
- **State Consistency**: Ensures state changes align with DAP protocol requirements

## Testing Framework and Dependencies

Built on **Vitest** testing framework with comprehensive coverage of:
- Core DAP functionality from `dap-core/index.js`
- State management functions from `dap-core/state.js`
- Type definitions including `PendingRequest` structures
- Standard DAP protocol message patterns and lifecycle events

This test suite serves as both validation and documentation for the DAP core module's message handling and state management capabilities, ensuring robust debugging session support.