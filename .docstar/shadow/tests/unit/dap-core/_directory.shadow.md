# tests\unit\dap-core/
@children-hash: 2662150e963e863c
@generated: 2026-02-15T09:01:25Z

## Purpose
This directory contains comprehensive unit tests for the DAP (Debug Adapter Protocol) core module, ensuring proper functionality of message handling and state management components that enable proxy-based debug session communication.

## Test Coverage Areas

### Core Message Processing (`handlers.test.ts`)
- **Primary Entry Point Testing**: `handleProxyMessage` function validation across multiple message types and scenarios
- **Session Management**: Session ID validation, mismatch handling, and state transitions
- **Debug Lifecycle Events**: Adapter configuration, launch, termination, and connection management
- **DAP Event Processing**: Thread tracking, execution control events (stopped, continued, terminated), and generic event forwarding
- **Error Handling**: Error message processing, warning generation, and unknown message type handling
- **Message Validation**: `isValidProxyMessage` function testing for structural integrity

### State Management (`state.test.ts`) 
- **State Initialization**: Testing `createInitialState` for proper session setup
- **Immutable Operations**: All state modification functions with strict immutability verification
- **Flag Management**: Session initialization and adapter configuration status tracking
- **Thread Management**: Current thread ID assignment and clearing for debugging context
- **Request Lifecycle**: Pending request addition, retrieval, removal, and bulk clearing operations
- **Bulk Updates**: Atomic multi-property state modifications

## Component Integration
The test suite validates the interaction between two core subsystems:
- **Message Handlers** process incoming proxy messages, validate sessions, and trigger state updates
- **State Management** provides immutable operations for tracking session status, thread context, and pending requests
- Together they enable reliable debug session proxying with proper event forwarding and state consistency

## Key Testing Patterns
- **Immutability Enforcement**: All state operations tested against frozen objects to guarantee no mutations
- **State Chaining**: Multi-step operations validated for proper intermediate state handling  
- **Mock Data Construction**: Comprehensive test fixtures for complex message and request structures
- **Command Verification**: Generated commands and events thoroughly validated for downstream consumption
- **Error Propagation**: Exception handling and warning generation tested across failure scenarios

## Public API Validation
The tests ensure reliability of the core DAP module's public interface:
- `handleProxyMessage`: Primary message processor with session validation and event handling
- `isValidProxyMessage`: Message structure validator
- `createInitialState`: Session state factory
- State manipulation functions: `setInitialized`, `setAdapterConfigured`, `setCurrentThreadId`, `updateState`
- Request management: `addPendingRequest`, `getPendingRequest`, `removePendingRequest`, `clearPendingRequests`

This test suite provides comprehensive coverage ensuring the DAP core module can reliably proxy debug sessions while maintaining proper state consistency and event forwarding capabilities.