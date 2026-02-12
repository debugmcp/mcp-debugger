# src\proxy/
@generated: 2026-02-12T21:01:17Z

## Overall Purpose and Responsibility

The `src/proxy` directory implements a Debug Adapter Protocol (DAP) proxy system that serves as an intermediary layer between MCP debug clients and language-specific debug adapters. The proxy enables robust debugging communication with multi-session support, child session management, and language-agnostic adapter orchestration through a policy-driven architecture.

## Key Components and Architecture

### Core Proxy Engine
- **`dap-proxy-core.ts`**: Main `ProxyRunner` orchestrator managing proxy lifecycle, communication channels (IPC/stdin), and message processing
- **`dap-proxy-worker.ts`**: Core `DapProxyWorker` that handles DAP session management using the Adapter Policy pattern to eliminate language-specific hardcoding
- **`dap-proxy-entry.ts`**: Production entry point with environment detection and auto-start logic

### Communication and Protocol Management
- **`minimal-dap.ts`**: Sophisticated DAP client (`MinimalDapClient`) with multi-session support, child session adoption, and VSCode-compatible message parsing
- **`child-session-manager.ts`**: Manages concurrent debug sessions for JavaScript debugging scenarios requiring multiple adapter instances
- **`dap-proxy-interfaces.ts`**: Comprehensive type system defining message protocols, dependency abstractions, and configuration interfaces

### Process and Connection Management
- **`dap-proxy-adapter-manager.ts`**: Generic debug adapter process spawner with platform-specific handling and graceful shutdown
- **`dap-proxy-connection-manager.ts`**: DAP connection management with retry logic, session initialization, and event handling
- **`proxy-manager.ts`**: High-level `ProxyManager` that orchestrates proxy processes, DAP message routing, and lifecycle management

### Configuration and Dependencies
- **`proxy-config.ts`**: Language-agnostic configuration interface for proxy startup parameters
- **`dap-proxy-dependencies.ts`**: Production dependency injection factory providing concrete implementations
- **`dap-proxy-bootstrap.js`**: Process bootstrap with orphan detection, heartbeat monitoring, and dynamic proxy loading

### Utility and Support Modules
- **`dap-proxy-message-parser.ts`**: Message parsing and validation for IPC communication
- **`dap-proxy-request-tracker.ts`**: Request timeout management with callback support
- **`signal-debug.ts`**: Signal debugging utilities for process termination diagnostics
- **`utils/`**: Orphan detection utilities for container-aware process lifecycle management

## Public API Surface

### Main Entry Points
- **`ProxyManager`**: Primary interface for spawning and managing debug proxy processes
- **`ProxyRunner`**: Core proxy execution engine for programmatic control
- **`MinimalDapClient`**: DAP client for direct debugging communication

### Key Interfaces
- **`IProxyManager`**: Contract for proxy lifecycle and DAP request handling
- **`ProxyConfig`**: Configuration interface for proxy startup
- **`ProxyManagerEvents`**: Typed event system for DAP events and status notifications

### Message Protocol
- **`ParentCommand`** union: Commands from parent process (init, DAP, terminate)
- **`ProxyMessage`** union: Responses to parent (status, DAP events, errors)

## Internal Organization and Data Flow

### Initialization Flow
1. **Bootstrap Phase**: `proxy-bootstrap.js` sets up process lifecycle, orphan detection, and loads proxy implementation
2. **Worker Creation**: `ProxyRunner` creates `DapProxyWorker` with dependency injection
3. **Adapter Selection**: Worker selects appropriate `AdapterPolicy` based on language/adapter type
4. **Process Spawning**: `GenericAdapterManager` spawns debug adapter process
5. **Connection**: `DapConnectionManager` establishes DAP protocol connection with retry logic

### Message Routing Architecture
- **Parent → Proxy**: Commands parsed by `MessageParser`, routed through `DapProxyWorker`
- **Proxy → Adapter**: DAP requests sent via `MinimalDapClient` with timeout tracking
- **Adapter → Proxy**: DAP events/responses processed and forwarded to parent
- **Multi-Session**: `ChildSessionManager` handles concurrent sessions for JavaScript debugging

### Policy-Driven Behavior
The system uses `AdapterPolicy` implementations to handle language-specific requirements:
- Command queueing strategies
- Child session creation decisions
- Breakpoint mirroring behavior
- State management customization

## Important Patterns and Conventions

### Dependency Injection
All components accept dependencies through interfaces (`ILogger`, `IFileSystem`, `IProcessSpawner`) enabling testability and modularity.

### Event-Driven Communication
Extensive use of EventEmitter pattern for async coordination between proxy components, child sessions, and parent processes.

### Graceful Error Handling
Comprehensive timeout management, retry logic with exponential backoff, and graceful degradation when optional operations fail.

### Container Awareness
Built-in container environment detection for proper orphan process handling in Docker/containerized deployments.

### Multi-Session Support
Native support for debugging scenarios requiring multiple concurrent debug adapter sessions, particularly for JavaScript debugging with js-debug/pwa-node.

The proxy system serves as a robust, language-agnostic debugging bridge that abstracts DAP complexity while providing sophisticated multi-session debugging capabilities and production-ready process management.