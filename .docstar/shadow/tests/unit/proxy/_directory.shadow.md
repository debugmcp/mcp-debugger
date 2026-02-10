# tests/unit/proxy/
@generated: 2026-02-09T18:16:19Z

## Purpose

This directory contains comprehensive unit test suites for the DAP (Debug Adapter Protocol) proxy module, which provides a bridge between the MCP (Model Context Protocol) system and debug adapters. The tests validate proxy connection management, message parsing, request tracking, process lifecycle, and error handling across the entire proxy subsystem.

## Module Organization

The test directory is structured around five core proxy components:

### Connection Management & DAP Communication
- **`dap-proxy-connection-manager.test.ts`**: Tests the `DapConnectionManager` class for establishing connections to debug adapters, handling retries (60 attempts with 200ms intervals), session initialization, and graceful disconnection with 1000ms timeout
- **`minimal-dap.test.ts`**: Comprehensive tests for `MinimalDapClient`, covering DAP message parsing, request/response correlation, child session integration, reverse request handling, and socket management
- **`dap-proxy-request-tracker.test.ts`**: Validates request lifecycle tracking with timeout management (30s default) and callback-based timeout handling for pending DAP requests

### Message Processing & Validation
- **`dap-proxy-message-parser.test.ts`**: Tests command parsing and validation for three proxy command types (init, dap, terminate) with comprehensive field validation and error handling
- **`proxy-manager-message-handling.test.ts`**: Tests ProxyManager's message routing, event propagation, cleanup scenarios, and resilience to malformed messages

### Process & Lifecycle Management
- **`proxy-manager.start.test.ts`**: Tests proxy process initialization, retry logic, timeout handling, environment validation, and graceful shutdown procedures
- **`proxy-manager.branch-coverage.test.ts`**: Branch coverage tests for edge cases in proxy command processing, DAP state validation, and launch barrier management
- **`proxy-manager.handshake.test.ts`**: Tests the initialization handshake between ProxyManager and proxy processes with exponential backoff retry logic
- **`orphan-check.test.ts`**: Validates orphan process detection utilities for proper proxy lifecycle management in container vs non-container environments

### Test Infrastructure
- **`proxy-manager-test-setup.ts`**: Test utility for managing expected Promise rejections during timeout scenarios, preventing test noise while preserving genuine error detection

## Key Testing Patterns

### Mock Architecture
- **Comprehensive Mocking**: All tests use extensive mocking of external dependencies (TCP sockets, file system, child processes, loggers)
- **EventEmitter-based Doubles**: Mock implementations extend EventEmitter to simulate asynchronous IPC and socket communication
- **Timer Control**: Fake timers enable deterministic testing of retry logic, timeouts, and async sequences

### Test Coverage Strategies
- **Happy Path + Edge Cases**: Each component tests successful operations alongside failure scenarios
- **Concurrent Operations**: Tests validate behavior under concurrent requests, rapid connection cycles, and resource cleanup
- **Error Boundary Testing**: Comprehensive validation of error propagation, recovery mechanisms, and graceful degradation
- **State Management**: Tests ensure proper internal state transitions and cleanup during various lifecycle events

## Public API Surface

The proxy module provides these main entry points tested by this suite:

### Core Classes
- **`DapConnectionManager`**: Primary connection management with retry logic and session handling
- **`MinimalDapClient`**: Low-level DAP protocol implementation with child session support
- **`ProxyManager`**: High-level proxy orchestration with lifecycle management and message routing
- **`MessageParser`**: Command validation and parsing for proxy communication
- **`RequestTracker`/`CallbackRequestTracker`**: Request lifecycle management with timeout handling

### Configuration & Utilities
- **Proxy Configuration**: Init payloads with debug adapter settings, breakpoints, and execution parameters
- **Process Management**: Orphan detection, process spawning, and cleanup utilities
- **Message Protocols**: DAP command/response/event handling with proper request correlation

## Internal Organization & Data Flow

### Request Processing Flow
1. **Command Parsing**: Raw messages → validated command objects via `MessageParser`
2. **Connection Management**: TCP connection establishment and retry logic via `DapConnectionManager`
3. **Request Correlation**: Outbound requests tracked with sequence numbers via `RequestTracker`
4. **Response Routing**: Incoming DAP responses correlated to pending requests and resolved
5. **Event Propagation**: DAP events forwarded through EventEmitter pattern to application layer

### Process Lifecycle
1. **Initialization**: ProxyManager launches proxy process and establishes IPC connection
2. **Handshake**: Retry-based initialization with exponential backoff (500ms to 8000ms timeouts)
3. **Steady State**: Message routing between MCP commands and DAP protocol operations
4. **Cleanup**: Graceful shutdown with pending request cleanup and resource disposal

### Error Handling Strategy
- **Connection Resilience**: Automatic retry with exponential backoff for transient failures
- **Timeout Management**: Configurable timeouts for all async operations with proper cleanup
- **Graceful Degradation**: Error boundary patterns prevent cascading failures
- **Resource Cleanup**: Comprehensive cleanup ensures no resource leaks during error scenarios

## Key Implementation Constants

- **Connection**: 60 max retries, 200ms intervals, 1000ms disconnect timeout
- **Requests**: 30-second timeout for DAP responses
- **Process**: 500ms-8000ms exponential backoff for proxy initialization
- **Heartbeat**: IPC telemetry logging and process health monitoring