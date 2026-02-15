# tests\unit\proxy/
@children-hash: 2f69c053f9b1f4ac
@generated: 2026-02-15T09:01:31Z

## Overview
The `tests/unit/proxy` directory contains comprehensive unit test coverage for the DAP (Debug Adapter Protocol) proxy subsystem, which enables debug session management and communication between debug adapters and clients. The test suite validates core proxy functionality including connection management, message parsing, request tracking, process lifecycle, and error handling scenarios.

## Key Components Tested

### ProxyManager (Core Orchestrator)
- **Entry Point**: Primary facade class managing proxy lifecycle and communication
- **Key Tests**: `proxy-manager.start.test.ts`, `proxy-manager.handshake.test.ts`, `proxy-manager.branch-coverage.test.ts`, `proxy-manager-message-handling.test.ts`
- **Functionality**: Process spawning, initialization handshakes, DAP request/response handling, retry logic, timeout management, and graceful shutdown

### Connection Management Layer
- **DapConnectionManager** (`dap-proxy-connection-manager.test.ts`): DAP client connection orchestration with exponential backoff retry logic, session initialization, breakpoint management, and event handler setup
- **MinimalDapClient** (`minimal-dap.test.ts`): Low-level DAP protocol communication, message parsing, request correlation, and child session integration

### Message Processing Infrastructure  
- **MessageParser** (`dap-proxy-message-parser.test.ts`): Command parsing and payload validation for init, DAP, and terminate message types with comprehensive error handling
- **RequestTracker** (`dap-proxy-request-tracker.test.ts`): Request lifecycle tracking with timeout management and callback-based timeout notifications

### Utility Components
- **Orphan Detection** (`orphan-check.test.ts`): Process orphan detection based on parent PID and container environment awareness
- **Test Infrastructure** (`proxy-manager-test-setup.ts`): Specialized timeout test handlers for managing expected rejections during timeout scenarios

## Test Architecture & Patterns

### Mock Strategy
- **Process Isolation**: Extensive use of mock proxy processes (`FakeProxyProcess`, `StubProxyProcess`) to avoid real process spawning
- **Network Mocking**: Mock DAP clients and socket implementations for network communication testing
- **Timer Control**: Comprehensive fake timer usage for deterministic retry logic and timeout testing
- **Dependency Injection**: Full mocking of file system, logger, and launcher dependencies

### Coverage Focus Areas
- **Connection Resilience**: Retry logic, exponential backoff, timeout handling, and error recovery
- **Message Protocol**: DAP message parsing, validation, request correlation, and event handling
- **Process Lifecycle**: Startup, handshake, graceful shutdown, and error scenarios
- **Concurrency**: Simultaneous requests, race conditions, and cleanup coordination
- **Edge Cases**: Malformed messages, orphaned processes, container environments, and resource exhaustion

## Key Testing Utilities

### TestProxyManager
Simplified proxy manager implementation that avoids complex process management while preserving message handling and event propagation behavior for focused unit testing.

### Async Coordination Patterns
- Event-driven testing with `EventEmitter` simulation
- Promise-based async coordination for concurrent scenarios  
- Deterministic timing control through fake timer advancement
- Request/response correlation validation

## Integration Points

### DAP Protocol Integration
Tests validate proper DAP message formatting, sequence number handling, event emission, and response correlation following the Debug Adapter Protocol specification.

### Child Session Management
Comprehensive testing of child session creation, adoption waiting, breakpoint mirroring, and request routing policies through mock child session managers.

### Error Handling & Recovery
Extensive validation of error scenarios including connection failures, timeout conditions, malformed messages, process exits, and resource cleanup to ensure robust proxy operation.

The test suite ensures the proxy subsystem can reliably manage debug sessions, handle protocol communication, and recover gracefully from various failure conditions while maintaining proper resource cleanup and state consistency.