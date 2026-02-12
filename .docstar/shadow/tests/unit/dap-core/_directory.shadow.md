# tests/unit/dap-core/
@generated: 2026-02-11T23:47:38Z

## Purpose
Unit test suite for the DAP (Debug Adapter Protocol) core module, providing comprehensive test coverage for message handling and state management components that enable proxy-based debug session communication.

## Test Coverage Structure

### Core Message Processing (`handlers.test.ts`)
Tests the primary DAP core functionality through the `handleProxyMessage` function, which serves as the main entry point for processing debug adapter communication. Test coverage includes:

- **Session Management**: Validation of session IDs and rejection of mismatched requests
- **Debug Lifecycle Events**: Processing of adapter configuration, launch, exit, and termination states
- **DAP Event Handling**: Thread tracking, continuation, and standard DAP event forwarding
- **Error Processing**: Error message handling with proper event emission
- **Message Validation**: Structural validation through `isValidProxyMessage`

### State Management (`state.test.ts`)
Tests the immutable state operations that underpin the DAP core's session tracking capabilities:

- **State Initialization**: Factory function testing for clean session state creation
- **Flag Management**: Testing of initialization and adapter configuration state flags
- **Thread Tracking**: Current thread ID assignment and management
- **Request Lifecycle**: Pending request addition, retrieval, removal, and bulk clearing
- **Immutability Guarantees**: Ensuring all state operations maintain immutability

## Key Components Integration

### Message Flow Pipeline
1. **Validation**: Messages validated via `isValidProxyMessage` before processing
2. **Handling**: `handleProxyMessage` processes validated messages based on type (status, error, DAP event)
3. **State Updates**: Handler functions update session state immutably using state management functions
4. **Command Generation**: Handlers emit appropriate commands (logging, events, process control)

### State Management Layer
- **Immutable Operations**: All state changes create new state objects without mutation
- **Session Tracking**: Maintains debug session context including initialization status and thread information
- **Request Management**: Tracks pending DAP requests with comprehensive lifecycle management

## Public API Surface
Based on test coverage, the main entry points include:

- `handleProxyMessage(message, state, sessionId)`: Primary message processor
- `isValidProxyMessage(message)`: Message structure validator
- `createInitialState(sessionId)`: State factory function
- State mutation functions: `setInitialized`, `setAdapterConfigured`, `setCurrentThreadId`
- Request management: `addPendingRequest`, `getPendingRequest`, `removePendingRequest`, `clearPendingRequests`
- `updateState`: Atomic multi-property state updates

## Test Patterns and Quality Assurance
- **Immutability Verification**: Extensive testing with frozen objects to guarantee no mutations
- **State Isolation**: Each test uses fresh state instances via setup hooks
- **Message Structure Consistency**: Standardized proxy message format validation
- **Command Verification**: Thorough validation of generated downstream commands
- **Error Handling**: Comprehensive testing of error conditions and edge cases

This test suite ensures the DAP core module can reliably process debug adapter communication, maintain session state integrity, and handle the full lifecycle of debugging sessions with proper error handling and state transitions.