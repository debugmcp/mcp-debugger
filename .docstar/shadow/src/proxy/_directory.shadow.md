# src\proxy/
@children-hash: 7f70b33c86a9b68f
@generated: 2026-02-24T01:55:23Z

## Overall Purpose

The `src/proxy` directory implements a Debug Adapter Protocol (DAP) proxy system that enables multi-language debugging support in the MCP Debugger. The proxy acts as an intermediary between debug clients and language-specific debug adapters, providing session management, policy-driven adapter selection, and multi-session debugging capabilities.

## Core Architecture

The proxy system follows a **worker process model** with IPC-based communication between a parent ProxyManager and child proxy workers. The architecture is built around several key patterns:

### Multi-Process Communication
- **ProxyManager** spawns isolated proxy worker processes for each debug session
- **IPC-based messaging** with fallback to stdin/stdout for communication
- **Message protocol** with typed command/response system (init, DAP commands, terminate)
- **Heartbeat monitoring** to detect orphaned processes and communication failures

### Policy-Driven Adapter System
- **Adapter Policy Pattern** eliminates language-specific hardcoding through pluggable policies
- **Language-specific policies** for JavaScript (js-debug), Python, Rust, Go, and mock adapters
- **Configurable behaviors** including command queueing, reverse request handling, and state management
- **Automatic adapter selection** based on command patterns and configuration

### Multi-Session Debug Support  
- **Child Session Management** for debuggers requiring concurrent sessions (e.g., js-debug with spawned processes)
- **Event forwarding** and **breakpoint mirroring** between parent and child sessions
- **Request routing logic** that determines whether to send commands to parent or child sessions
- **Session lifecycle coordination** with proper cleanup and error handling

## Key Components Integration

### Proxy Lifecycle Management
1. **ProxyManager** creates worker process using **ProxyBootstrap** 
2. **DapProxyWorker** initializes with injected dependencies from **DapProxyDependencies**
3. **AdapterManager** spawns language-specific debug adapter processes
4. **ConnectionManager** establishes DAP connections with retry logic
5. **MinimalDapClient** handles DAP protocol communication with policy integration

### Message Flow Architecture
```
Parent Process (ProxyManager) 
    ↕ IPC Messages (ProxyInitPayload, DapCommandPayload)
Child Process (DapProxyWorker)
    ↕ DAP Protocol (MinimalDapClient)
Debug Adapter (language-specific)
```

### State Management
- **ProxyState** state machine (UNINITIALIZED → INITIALIZING → CONNECTED → TERMINATED)
- **Request tracking** with timeout management and correlation IDs
- **Command queueing** for adapters requiring ordered message sequences
- **Session-specific logging** with structured error reporting

## Public API Surface

### Main Entry Points
- **ProxyManager class** - Primary interface for starting/stopping debug proxy sessions
- **ProxyConfig interface** - Configuration for proxy initialization
- **ProxyManagerEvents** - Typed event system for DAP events and proxy lifecycle

### Core Methods
- `ProxyManager.start(config: ProxyConfig)` - Spawns proxy worker and initializes debug session
- `ProxyManager.sendDapRequest<T>(command, args)` - Sends DAP commands with promise-based responses
- `ProxyManager.stop()` - Graceful shutdown with cleanup and force-kill fallback

### Configuration System
- **Language-agnostic configuration** via ProxyConfig with adapter command specification
- **Environment-based detection** for container deployment and orphan process handling
- **Dependency injection** pattern for testability and modularity

## Internal Organization

### Process Management Layer
- **proxy-bootstrap.js** - Process lifecycle initialization and orphan detection
- **proxy-manager.ts** - High-level proxy orchestration and IPC management
- **dap-proxy-core.ts** - Worker process coordination and communication channels

### DAP Protocol Layer  
- **dap-proxy-worker.ts** - Core DAP protocol handling and adapter policy integration
- **minimal-dap.ts** - DAP client implementation with multi-session support
- **child-session-manager.ts** - Complex multi-session debugging coordination

### Infrastructure Layer
- **dap-proxy-dependencies.ts** - Production dependency injection factory
- **dap-proxy-interfaces.ts** - Comprehensive type system and abstractions
- **utils/** - Process lifecycle utilities for container-aware orphan detection

## Important Patterns

### Defensive Programming
- Comprehensive timeout handling for all operations (connections, requests, shutdowns)
- Graceful degradation with fallback strategies (IPC→stdout, connection retries)
- Extensive error boundaries with structured error reporting
- Process cleanup with signal escalation (SIGTERM → SIGKILL → taskkill)

### Container-Aware Design
- Special handling for containerized environments where PPID=1 is normal
- Environment variable detection for deployment context
- Signal debugging utilities for troubleshooting termination issues

### Testability Architecture
- Complete dependency injection with interface abstractions
- Pure functional utilities with no side effects
- Clean separation between imperative shell (I/O) and functional core (state management)
- Mock-friendly design with pluggable policies and factories

The proxy system provides a robust, production-ready foundation for multi-language debugging that handles the complexity of modern debugging scenarios including multi-process applications, containerized deployments, and various debug adapter protocols.