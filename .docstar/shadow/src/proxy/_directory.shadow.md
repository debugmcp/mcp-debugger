# src\proxy/
@generated: 2026-02-12T21:06:04Z

## Overview

The `src/proxy` directory implements a Debug Adapter Protocol (DAP) proxy system that bridges MCP debug clients with language-specific debug adapters. The proxy operates as an isolated worker process, managing debug adapter spawning, DAP message routing, and multi-session debugging scenarios with pluggable adapter policies.

## Primary Responsibilities

- **Process Isolation**: Runs debug adapters in separate processes to prevent crashes from affecting the main MCP server
- **Protocol Translation**: Routes DAP messages between clients and adapters with request/response correlation
- **Multi-Session Management**: Supports child debug sessions for complex scenarios like JavaScript debugging
- **Language Abstraction**: Uses adapter policies to eliminate hardcoded language-specific behavior
- **Lifecycle Management**: Handles graceful startup, shutdown, and orphan detection across deployment environments

## Core Architecture

### Entry Points & Process Management
- **`proxy-bootstrap.js`**: Process bootstrap that handles signal management, orphan detection, and dynamic module loading
- **`dap-proxy-entry.ts`**: Production entry point with environment detection and auto-execution logic
- **`ProxyManager`**: High-level orchestrator for spawning and communicating with proxy processes
- **`ProxyRunner`**: Core business logic for proxy lifecycle without auto-execution side effects

### DAP Protocol Layer
- **`DapProxyWorker`**: Main worker class implementing the complete DAP proxy lifecycle using adapter policies
- **`MinimalDapClient`**: Sophisticated DAP client with multi-session support and child session adoption
- **`DapConnectionManager`**: Connection management with retry logic and timeout handling
- **Request Tracking**: `CallbackRequestTracker` and `RequestTracker` for timeout management and request correlation

### Multi-Session Support
- **`ChildSessionManager`**: Manages spawned debug sessions for JavaScript debugging scenarios with js-debug/pwa-node
- **Policy Integration**: Adapter policies determine routing, child session behavior, and protocol customization
- **Event Forwarding**: Transparent routing of DAP events between parent and child sessions

### Message Processing & Communication
- **`MessageParser`**: Parses and validates IPC messages from parent processes into typed commands
- **Type System**: Comprehensive interfaces in `dap-proxy-interfaces.ts` defining the complete message protocol
- **Dependency Injection**: Clean separation of concerns through `DapProxyDependencies` container

## Data Flow

1. **Initialization**: `ProxyManager.start()` spawns worker process via `proxy-bootstrap.js`
2. **Worker Setup**: Bootstrap loads `dap-proxy-entry.ts` which initializes `ProxyRunner` with `DapProxyWorker`
3. **Adapter Selection**: Worker uses `AdapterPolicy` system to determine language-specific behavior
4. **Process Spawning**: `GenericAdapterManager` spawns debug adapter using policy configuration
5. **Connection**: `DapConnectionManager` establishes DAP connection with retry logic
6. **Message Routing**: DAP commands flow through request tracking, policy routing, and child session management
7. **Event Forwarding**: Debug events propagate back through the proxy to the MCP client

## Key Integration Patterns

### Adapter Policy System
The proxy eliminates hardcoded language logic through pluggable `AdapterPolicy` implementations that control:
- Debug adapter spawn configuration
- DAP command routing and queueing behavior
- Child session creation decisions
- State management and event handling

### Container-Aware Deployment
The `utils/orphan-check.ts` module provides container-aware orphan detection, ensuring proxy processes behave correctly in both traditional host and containerized environments.

### Request/Response Correlation
Sophisticated timeout management tracks all DAP requests with automatic cleanup, preventing hung requests and resource leaks in long-running debug sessions.

## Public API Surface

**Main Entry Points:**
- `ProxyManager`: High-level proxy process orchestration
- `ProxyConfig`: Configuration interface for proxy startup
- `ProxyRunner`: Core proxy logic for programmatic control

**Worker System:**
- `DapProxyWorker`: Complete DAP proxy implementation
- `MessageParser`: Command parsing and validation
- `MinimalDapClient`: DAP client with multi-session capabilities

**Utilities:**
- `createProductionDependencies()`: Dependency injection factory
- `detectExecutionMode()`: Environment detection
- `shouldExitAsOrphanFromEnv()`: Container-aware orphan detection

## Critical Invariants

- Proxy processes are properly isolated and communicate only via IPC
- All DAP requests receive responses or timeout notifications
- Child sessions are created and managed based on adapter policy decisions
- Graceful shutdown handles both normal termination and orphan scenarios
- Adapter policies ensure language-agnostic proxy behavior