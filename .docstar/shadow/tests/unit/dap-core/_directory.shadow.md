# tests/unit/dap-core/
@generated: 2026-02-10T01:19:40Z

## Purpose
This directory contains comprehensive unit tests for the DAP (Debug Adapter Protocol) core module, which handles debug session communication and state management. The tests validate the critical message processing pipeline and immutable state operations that enable VS Code debugging capabilities.

## Test Coverage Overview

The test suite provides complete validation of two core components:

### Message Handling (`handlers.test.ts`)
- **Primary Entry Point**: Tests `handleProxyMessage` function that processes all incoming debug protocol messages
- **Message Validation**: Tests `isValidProxyMessage` for message structure validation
- **Session Management**: Validates session ID matching and invalid session handling
- **Debug Lifecycle**: Covers adapter configuration, launch, termination, and error states
- **Event Processing**: Tests DAP event forwarding (stopped, continued, terminated, exited)
- **Command Generation**: Verifies downstream command emission for logging, events, and process control

### State Management (`state.test.ts`)
- **State Factory**: Tests `createInitialState` for session initialization
- **Flag Operations**: Validates `setInitialized`, `setAdapterConfigured`, and `setCurrentThreadId`
- **Request Tracking**: Tests pending request lifecycle with `addPendingRequest`, `getPendingRequest`, `removePendingRequest`, `clearPendingRequests`
- **Bulk Updates**: Validates `updateState` for atomic multi-property changes
- **Immutability**: Ensures all operations preserve immutable state patterns

## Integration Pattern

The tests validate the complete message processing flow:
1. **Message Reception**: Proxy messages arrive and undergo validation
2. **Session Verification**: Session ID matching prevents cross-session contamination  
3. **State Updates**: Handler functions update session state immutably
4. **Event/Command Emission**: Processed messages generate appropriate downstream actions
5. **Request Management**: Debug requests are tracked through their lifecycle

## Key Testing Patterns

- **Immutability Enforcement**: All state operations tested against frozen objects
- **State Isolation**: Fresh state created for each test via `beforeEach` hooks
- **Message Structure Validation**: Consistent proxy message format verification
- **Command Verification**: Thorough validation of generated commands and events
- **Error Handling**: Testing of warning generation and error propagation

## Dependencies Validated

Tests verify integration with:
- **Vitest**: Testing framework providing describe/it/expect structure
- **DAP Core Types**: Type definitions for messages, state, and pending requests
- **State Management**: All core state manipulation functions
- **Message Processing**: Primary handler and validation functions

This test suite ensures the reliability of VS Code's debug adapter communication layer, validating that debug sessions maintain proper state isolation, message routing, and event processing throughout the debugging lifecycle.