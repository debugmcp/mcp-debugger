# tests\unit\proxy/
@generated: 2026-02-12T21:01:01Z

## Purpose
Comprehensive unit test suite for the proxy module's Debug Adapter Protocol (DAP) infrastructure. Tests all critical components involved in managing debugger connections, message handling, process lifecycle, and communication between MCP proxy and debug adapters.

## Module Organization

### Core Communication Infrastructure
- **dap-proxy-connection-manager.test.ts**: Tests DAP client connection orchestration with retry logic, session management, and event handling
- **minimal-dap.test.ts**: Tests low-level DAP protocol communication, message parsing, and socket-based network handling
- **dap-proxy-message-parser.test.ts**: Validates command parsing and payload validation for different message types (init, dap, terminate)

### Request Management & Tracking
- **dap-proxy-request-tracker.test.ts**: Tests request lifecycle tracking, timeout handling, and callback mechanisms for debugging sessions
- **proxy-manager-message-handling.test.ts**: Comprehensive message routing, event propagation, and cleanup scenario testing

### Process & Lifecycle Management
- **proxy-manager.start.test.ts**: Tests proxy initialization, environment validation, and process startup with retry logic
- **proxy-manager.handshake.test.ts**: Validates handshake protocol between proxy manager and spawned processes
- **proxy-manager.branch-coverage.test.ts**: Edge case testing for command processing and launch barrier management

### Utilities & Infrastructure
- **orphan-check.test.ts**: Tests process orphan detection utilities for container-aware cleanup
- **proxy-manager-test-setup.ts**: Test infrastructure for handling expected timeout rejections during proxy testing

## Key Testing Patterns

### Mock Architecture
- **Comprehensive Mocking**: All components use extensive mocking of network sockets, file systems, loggers, and child processes
- **EventEmitter Simulation**: Tests heavily rely on EventEmitter patterns for async communication testing
- **Fake Timer Integration**: Deterministic testing of retry logic, timeouts, and backoff strategies

### Test Categories
- **Connection Management**: Socket lifecycle, retry mechanisms, error recovery
- **Message Protocol**: DAP message formatting, parsing, validation, and routing
- **Process Lifecycle**: Proxy spawning, initialization handshakes, graceful shutdown
- **Concurrency**: Simultaneous requests, race conditions, cleanup scenarios
- **Error Resilience**: Network failures, timeout handling, invalid message processing

## Key Dependencies & Integration Points

### External Dependencies
- **@vscode/debugprotocol**: DAP message types and protocol definitions
- **@debugmcp/shared**: Common interfaces and policy management
- **vitest**: Primary testing framework with mocking and fake timer capabilities

### Internal Dependencies
- **ProxyManager**: Central orchestrator for proxy process lifecycle
- **DapConnectionManager**: Handles DAP client connections and session management
- **MinimalDapClient**: Low-level DAP protocol implementation
- **MessageParser**: Command validation and payload parsing utilities

## Public API Coverage

### ProxyManager (Primary Entry Point)
- `start()`: Proxy initialization with environment validation
- `stop()`: Graceful shutdown with cleanup
- `sendCommand()`: DAP command dispatch with response tracking
- Event handling: initialization, status updates, adapter configuration

### Connection Management
- `connectWithRetry()`: Robust connection establishment with exponential backoff
- `disconnect()`: Graceful disconnection with timeout handling
- Session initialization and event handler setup

### Message Processing
- Command parsing from objects and JSON strings
- Payload validation for init/dap/terminate message types
- Request tracking with timeout and callback mechanisms

## Test Infrastructure Features

### Timing Control
- Fake timers for deterministic async behavior testing
- Configurable retry intervals and timeout periods
- Race condition simulation and timing verification

### Error Injection
- Strategic failure simulation at all communication layers
- Timeout scenario testing with configurable parameters
- Network failure and recovery testing

### State Verification
- Comprehensive internal state checking across all components
- Event emission validation and parameter verification
- Cleanup verification for pending requests and timeouts

The test suite ensures robust proxy functionality through exhaustive coverage of normal operations, error conditions, and edge cases across the entire DAP communication pipeline.