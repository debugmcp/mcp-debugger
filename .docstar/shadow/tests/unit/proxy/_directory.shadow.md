# tests\unit\proxy/
@generated: 2026-02-12T21:05:54Z

## Overview
This directory contains comprehensive unit tests for the DAP (Debug Adapter Protocol) proxy system, which enables debugging of target programs through a standardized protocol interface. The proxy acts as an intermediary between debug clients and debug adapters, managing connections, message routing, session lifecycle, and state synchronization.

## Core Components Tested

### ProxyManager (`proxy-manager*.test.ts`)
The central orchestrator for debugging sessions that manages:
- **Session lifecycle**: Start/stop operations, initialization handshakes, and cleanup
- **Process management**: Proxy process spawning, monitoring, and termination
- **Message routing**: Bidirectional communication between clients and debug adapters
- **Error handling**: Retry logic, timeout management, and graceful failure recovery
- **State tracking**: Session state, thread information, and dry-run execution snapshots

Key test files:
- `proxy-manager.start.test.ts`: Startup, initialization, and script resolution
- `proxy-manager.handshake.test.ts`: Init retry logic with exponential backoff
- `proxy-manager.branch-coverage.test.ts`: Edge cases and command processing
- `proxy-manager-message-handling.test.ts`: Event propagation and cleanup scenarios

### DapConnectionManager (`dap-proxy-connection-manager.test.ts`)
Manages DAP client connections with sophisticated retry and error recovery:
- **Connection establishment**: Retry logic with 200ms intervals and exponential backoff
- **Session initialization**: Python adapter configuration and client ID management
- **Breakpoint management**: Setting, validation, and synchronization
- **Event handling**: DAP event registration and forwarding
- **Graceful disconnection**: Timeout handling and resource cleanup

### Message Processing (`dap-proxy-message-parser.test.ts`)
Validates command parsing and payload validation for different message types:
- **Command parsing**: From objects and JSON strings
- **Payload validation**: Init, DAP, and terminate payloads with comprehensive error checking
- **Type safety**: Field validation, type checking, and boundary condition handling

### Request Tracking (`dap-proxy-request-tracker.test.ts`)
Manages request lifecycle and timeout handling:
- **RequestTracker**: Basic request tracking with timeout management
- **CallbackRequestTracker**: Extended functionality with timeout callbacks
- **Concurrency handling**: Multiple simultaneous requests and race conditions

### Network Communication (`minimal-dap.test.ts`)
Low-level DAP protocol communication and message handling:
- **Message parsing**: DAP protocol message assembly from network chunks
- **Request/response correlation**: Sequence number management and timeout handling
- **Child session management**: Multi-session debugging support
- **Event propagation**: DAP events forwarded to client handlers

## Supporting Utilities

### Orphan Detection (`orphan-check.test.ts`)
Process lifecycle management for container and non-container environments:
- **Orphan detection**: Parent process monitoring and container-aware exit logic
- **Environment handling**: Container flag interpretation and process cleanup

### Test Infrastructure (`proxy-manager-test-setup.ts`)
Test utilities for managing unhandled promise rejections during timeout scenarios:
- **Error filtering**: Expected timeout exceptions vs genuine errors
- **Test isolation**: Clean test environment without noise from expected failures

## Key Design Patterns

### Mock Architecture
Comprehensive mocking strategy using:
- **Fake timers**: Deterministic async behavior testing with `vi.advanceTimersByTime()`
- **Event simulation**: EventEmitter-based mocks for IPC and network communication
- **Dependency injection**: Mock factories for loggers, filesystem, and network components

### Retry and Timeout Logic
Consistent patterns across components:
- **Exponential backoff**: 200ms intervals with configurable max attempts
- **Timeout handling**: 30-second initialization, 1000ms disconnect timeouts
- **Error recovery**: Graceful degradation and resource cleanup

### Concurrent Operation Testing
Sophisticated testing of race conditions and concurrent scenarios:
- **Multiple simultaneous requests**: Out-of-order response handling
- **Rapid state transitions**: Connect/disconnect cycles and cleanup validation
- **Resource lifecycle**: Proper cleanup of pending operations during shutdown

## Integration Points

The proxy system integrates with several external components:
- **Debug Adapters**: Language-specific debugging backends (Python, JavaScript, etc.)
- **DAP Clients**: VS Code and other DAP-compatible debugging frontends
- **Child Sessions**: Multi-target debugging scenarios
- **Container Runtime**: Docker and containerized debugging environments

## Test Coverage Strategy

The test suite provides comprehensive coverage of:
- **Happy path scenarios**: Normal operation and successful flows
- **Error conditions**: Network failures, timeouts, and malformed messages
- **Edge cases**: Boundary conditions, race conditions, and resource exhaustion
- **Resilience testing**: Recovery from failures and cleanup scenarios

This testing approach ensures the proxy system can reliably handle production debugging scenarios with proper error recovery and resource management.