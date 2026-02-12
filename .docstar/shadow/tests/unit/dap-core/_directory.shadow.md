# tests\unit\dap-core/
@generated: 2026-02-12T21:00:56Z

## Purpose
Unit test suite for the DAP (Debug Adapter Protocol) core module, providing comprehensive validation of message handling and state management functionality. This test directory ensures the reliability of the proxy communication system between debug clients and debug adapters.

## Key Components and Integration

### Message Handler Testing (`handlers.test.ts`)
Tests the core message processing pipeline that handles communication between debug clients and adapters:
- **Message Validation**: Tests proxy message structure validation and session ID verification
- **Status Message Processing**: Validates handling of debug adapter lifecycle events (configuration, launch, exit)
- **DAP Event Forwarding**: Tests proper forwarding of debug events (`stopped`, `continued`, `terminated`, `exited`) 
- **Error Handling**: Ensures proper error propagation and warning generation
- **Command Generation**: Validates creation of downstream commands for logging and process control

### State Management Testing (`state.test.ts`)
Tests the immutable state operations that maintain debug session information:
- **State Initialization**: Validates creation of initial session state with proper defaults
- **Flag Management**: Tests session status flags (initialized, adapter configured)
- **Thread Tracking**: Validates current thread ID management for debugging contexts
- **Pending Request Management**: Tests CRUD operations for tracking in-flight debug requests
- **Immutability Guarantees**: Ensures all state operations maintain immutability

## Public API Coverage
The test suite validates the main entry points of the DAP core module:
- `handleProxyMessage`: Primary message processor for all proxy communications
- `isValidProxyMessage`: Message structure validator
- `createInitialState`: Session state factory
- State management functions: `setInitialized`, `setAdapterConfigured`, `setCurrentThreadId`
- Request management: `addPendingRequest`, `getPendingRequest`, `removePendingRequest`, `clearPendingRequests`
- `updateState`: Atomic multi-property state updates

## Internal Organization and Data Flow
Tests validate the complete message processing workflow:
1. **Message Receipt**: Proxy messages arrive and undergo validation
2. **Session Verification**: Session IDs are checked for consistency
3. **Message Type Routing**: Different message types (status, error, DAP events) are processed appropriately
4. **State Updates**: Session state is updated based on message content (thread IDs, adapter status)
5. **Command Generation**: Appropriate commands are generated for downstream consumers
6. **Event Emission**: DAP events are forwarded to debug clients

## Important Patterns and Conventions
- **Immutability**: All state operations create new objects rather than mutating existing ones
- **Session-Based Processing**: All operations are scoped to specific debug session IDs
- **Two-Phase Message Handling**: Phase 1 (proxy status/error messages) and Phase 2 (DAP events)
- **Comprehensive Error Handling**: Unknown message types and invalid sessions generate appropriate warnings
- **Mock-Based Testing**: Uses consistent mock data structures and frozen objects to ensure behavioral correctness
- **State Chaining**: Tests validate that state operations can be safely chained together

The test suite ensures the DAP core module can reliably manage debug session communication, maintain session state, and properly route messages between debug clients and adapters in a multi-session debugging environment.