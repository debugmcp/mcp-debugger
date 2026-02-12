# tests\unit\dap-core/
@generated: 2026-02-12T21:05:42Z

## Purpose
Unit test suite for the DAP (Debug Adapter Protocol) core module, providing comprehensive validation of message handling logic and immutable state management for debug session communication.

## Module Coverage
This test directory validates two critical components of the DAP core system:

### Message Processing (`handlers.test.ts`)
Tests the primary message handling pipeline that processes proxy messages from debug adapters:
- **Session Management**: Validates session ID matching and invalid session handling
- **Lifecycle Events**: Tests debug adapter initialization, configuration, launch, and termination flows
- **DAP Event Forwarding**: Validates proper handling of standard DAP events (`stopped`, `continued`, `terminated`, `exited`)
- **Error Processing**: Tests error message handling and propagation
- **State Transitions**: Verifies state updates during debug session lifecycle

### State Management (`state.test.ts`)
Tests immutable state operations for debug session tracking:
- **State Initialization**: Validates creation of initial session state
- **Flag Management**: Tests boolean state flags (initialized, adapterConfigured)
- **Thread Tracking**: Validates current thread ID management
- **Request Lifecycle**: Tests pending request Map operations (add, get, remove, clear)
- **Immutability**: Ensures all state operations preserve immutability

## Key Components Tested

### Core Functions
- `handleProxyMessage`: Primary message processor handling all proxy communication
- `isValidProxyMessage`: Message structure validator
- `createInitialState`: State factory function
- State mutation functions: `setInitialized`, `setAdapterConfigured`, `setCurrentThreadId`
- Pending request management: `addPendingRequest`, `getPendingRequest`, `removePendingRequest`, `clearPendingRequests`
- `updateState`: Bulk state update function

### Data Flow
1. Proxy messages arrive and undergo validation (`isValidProxyMessage`)
2. Valid messages are processed by `handleProxyMessage` with session validation
3. Message processing triggers state updates through immutable state functions
4. State changes generate appropriate commands and events for downstream consumers

## Testing Patterns
- **Immutability Verification**: All tests validate that state operations create new objects rather than mutating existing ones
- **State Isolation**: Each test uses fresh state via `beforeEach` hooks
- **Command Validation**: Thorough verification of generated commands and events
- **Mock Data**: Consistent mock object construction for complex types like `PendingRequest`

## Critical Behaviors Validated
- Session ID validation and security
- Debug adapter lifecycle management
- Thread tracking for multi-threaded debugging
- Error handling and logging
- Event forwarding to debug clients
- Immutable state transitions
- Pending request tracking for command correlation

This test suite ensures the DAP core module can reliably handle debug session communication while maintaining proper state isolation and immutability guarantees.