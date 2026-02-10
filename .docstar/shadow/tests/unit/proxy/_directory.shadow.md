# tests/unit/proxy/
@generated: 2026-02-10T21:27:26Z

## Overall Purpose

The `tests/unit/proxy` directory contains comprehensive unit tests for the DAP (Debug Adapter Protocol) proxy system that orchestrates Python debugging sessions. This test suite validates the core infrastructure that manages debug adapter connections, message routing, session lifecycle, and child session coordination in a distributed debugging environment.

## Key Components and Their Relationships

### Core Management Layer
- **ProxyManager** (`proxy-manager*.test.ts`) - Central orchestrator for proxy lifecycle, process management, and DAP communication
- **DapConnectionManager** (`dap-proxy-connection-manager.test.ts`) - Handles DAP client connections with retry logic and session initialization
- **MessageParser** (`dap-proxy-message-parser.test.ts`) - Validates and parses proxy commands (init, DAP, terminate)
- **RequestTracker** (`dap-proxy-request-tracker.test.ts`) - Manages request/response correlation and timeout handling

### Communication Layer
- **MinimalDapClient** (`minimal-dap.test.ts`) - Low-level DAP protocol client with message parsing and child session integration
- **Message Handling** - Tests event propagation, status updates, and error scenarios across the proxy communication stack

### Utilities
- **Orphan Detection** (`orphan-check.test.ts`) - Process orphan detection for container-aware cleanup
- **Test Infrastructure** (`proxy-manager-test-setup.ts`) - Timeout test utilities for managing expected promise rejections

## Public API Surface

### Primary Entry Points
- **ProxyManager**: Main proxy lifecycle management with `start()`, `stop()`, and DAP request routing
- **DapConnectionManager**: DAP client connection orchestration with `connectWithRetry()`, session initialization, and breakpoint management
- **MessageParser**: Command parsing and validation with `parseCommand()` and payload validators
- **MinimalDapClient**: Low-level DAP communication with request/response handling and child session support

### Key Interfaces Tested
- `IProxyProcess`, `IProxyProcessLauncher` - Process management abstractions
- `IDapClient`, `IDapClientFactory` - DAP client abstractions
- `ProxyInitPayload`, `DapCommandPayload`, `TerminatePayload` - Message format contracts

## Internal Organization and Data Flow

### Request Flow
1. **Command Parsing** (MessageParser) → **Validation** → **ProxyManager routing**
2. **DAP Requests** → **DapConnectionManager** → **MinimalDapClient** → **Protocol transmission**
3. **Response Correlation** via RequestTracker with timeout management
4. **Event Propagation** from DAP client through manager to application layer

### Session Lifecycle
1. **Initialization**: ProxyManager starts proxy process with retry logic and handshake validation
2. **Connection**: DapConnectionManager establishes DAP client with exponential backoff (200ms intervals, 60 max attempts)
3. **Configuration**: Python adapter setup with launch parameters and breakpoint synchronization  
4. **Operation**: Request routing, child session management, and event forwarding
5. **Cleanup**: Graceful termination with pending request cleanup and timeout clearing

### Error Handling Patterns
- **Retry Logic**: Exponential backoff for transient connection failures
- **Timeout Management**: 30-second initialization, 1-second disconnect timeouts
- **Graceful Degradation**: Fallback behaviors for missing components and communication failures
- **Resource Cleanup**: Comprehensive cleanup on exit/error scenarios

## Important Patterns and Conventions

### Testing Infrastructure
- **Mock Architecture**: Comprehensive mocking of network, filesystem, and logging dependencies
- **Fake Timers**: Deterministic async testing with `vi.useFakeTimers()` for retry and timeout scenarios
- **Event-Driven Testing**: EventEmitter-based test coordination for async operations
- **Type Casting**: Strategic use of type assertions to access private members for internal state verification

### Protocol Patterns
- **Message Framing**: Content-Length header protocol for DAP message boundaries
- **Session Management**: SessionId-based request routing and child session coordination
- **Command Structure**: Type-safe payload validation for init/DAP/terminate commands
- **Error Propagation**: Structured error handling with diagnostic information preservation

### Concurrency Handling
- **Request Correlation**: Sequence number-based request/response matching
- **Concurrent Protection**: Prevention of duplicate start operations and race condition handling
- **Child Session Coordination**: Adoption waiting, breakpoint mirroring, and request routing policies
- **Cleanup Coordination**: Proper resource disposal during concurrent operations

This test suite ensures reliable operation of the DAP proxy system across various failure modes, timing scenarios, and concurrent access patterns, providing confidence in the debugging infrastructure's robustness.