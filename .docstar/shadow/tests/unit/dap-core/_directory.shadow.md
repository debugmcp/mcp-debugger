# tests/unit/dap-core/
@generated: 2026-02-10T21:26:20Z

## Purpose
Unit test suite for the DAP (Debug Adapter Protocol) core module, providing comprehensive validation of message handling, state management, and protocol communication for debug session proxy functionality.

## Overall Module Responsibility
The `dap-core` module serves as the central message processing and state management layer for debug adapter protocol sessions. It handles bidirectional communication between debug clients and adapters, manages session state, and translates protocol messages into actionable commands and events.

## Key Components and Relationships

### Message Handling (`handlers.test.ts`)
Tests the core message processing pipeline that:
- Validates incoming proxy messages for session integrity
- Processes status messages from debug adapters (lifecycle events, IPC tests, configuration)
- Handles error propagation with proper event emission
- Forwards DAP events (stopped, continued, terminated, exited) with state synchronization
- Manages thread tracking for debugging sessions
- Generates warnings for invalid sessions or unknown message types

### State Management (`state.test.ts`)
Tests immutable state operations for:
- Session initialization and configuration tracking
- Debug adapter lifecycle flags (initialized, configured)
- Current thread ID management for debugging context
- Pending request tracking with Map-based storage
- Atomic bulk state updates

## Public API Surface
**Core Functions:**
- `handleProxyMessage`: Primary message processor for DAP proxy communication
- `isValidProxyMessage`: Message structure validator
- `createInitialState`: Session state factory

**State Operations:**
- `setInitialized`, `setAdapterConfigured`: Lifecycle flag management
- `setCurrentThreadId`: Thread context tracking  
- `addPendingRequest`, `getPendingRequest`, `removePendingRequest`, `clearPendingRequests`: Request lifecycle management
- `updateState`: Atomic multi-property updates

## Internal Organization and Data Flow

### Message Processing Pipeline
1. **Validation**: Session ID verification and message structure validation
2. **Routing**: Message type classification (status, error, DAP event)
3. **Processing**: State updates, command generation, event emission
4. **Output**: Structured commands for downstream consumers

### State Management Flow
- **Immutable Operations**: All state changes create new objects
- **Session Tracking**: Centralized session state with lifecycle management
- **Request Management**: Map-based pending request tracking with cleanup
- **Thread Context**: Current debugging thread ID maintenance

## Important Patterns and Conventions

### Testing Patterns
- **Immutability Enforcement**: All tests verify no state mutation using frozen objects
- **Fresh State**: Each test uses newly created state via `beforeEach`
- **Mock Data Construction**: Consistent proxy message structure validation
- **Command Verification**: Thorough validation of generated logging, events, and process control commands

### Protocol Handling
- **Session Validation**: Strict session ID matching with warning generation
- **Event Forwarding**: Direct DAP event passthrough with state synchronization
- **Error Propagation**: Structured error handling with event emission
- **Lifecycle Management**: Debug adapter state tracking through configuration and execution phases

### State Architecture
- **Immutable Design**: No direct state mutations, always return new state objects
- **Type Safety**: Comprehensive TypeScript types for all message and state structures
- **Request Tracking**: Map-based storage for pending debug protocol requests
- **Thread Management**: Current debugging context maintenance

The module serves as the foundational layer for debug session management, ensuring reliable message processing and consistent state management across debug adapter protocol interactions.