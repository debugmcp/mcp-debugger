# src\proxy/
@children-hash: 9568cf52ab6b15fd
@generated: 2026-02-16T09:12:59Z

## Overall Purpose and Responsibility

The `src/proxy` module implements a sophisticated Debug Adapter Protocol (DAP) proxy system that bridges debugging clients and language-specific debug adapters. The proxy provides language-agnostic debugging capabilities through a policy-driven architecture, enabling multi-session debugging, request queuing, and child session management without hardcoding language-specific behavior.

## Key Components and Architecture

### Core Proxy System
- **DapProxyWorker**: Main orchestration engine managing debug session lifecycle with state machine transitions (UNINITIALIZED → INITIALIZING → CONNECTED/TERMINATED)
- **ProxyManager**: High-level process orchestrator that spawns, communicates with, and manages proxy worker processes
- **ProxyRunner**: Pure business logic coordinator handling communication channels (IPC/stdin) and lifecycle management

### Communication Layer
- **MinimalDapClient**: Sophisticated DAP protocol client with TCP-based communication, multi-session support, and policy-driven behavior
- **MessageParser**: Message parsing and validation utilities for IPC communication between parent and proxy processes
- **RequestTracker**: Timeout management system preventing hanging DAP requests

### Multi-Session Architecture
- **ChildSessionManager**: Manages child debug adapter sessions for concurrent debugging scenarios (particularly JavaScript debugging with js-debug)
- Handles child session creation, lifecycle management, event forwarding, and breakpoint mirroring
- Prevents infinite recursion through policy-based reverse debugging disabling

### Policy-Driven Behavior
- **AdapterPolicy System**: Eliminates language-specific hardcoding through pluggable adapter policies
- Supports JavaScript (js-debug), Python (debugpy), Go (Delve), Rust (CodeLLDB), and extensible policy framework
- Configures command queueing, initialization sequences, state management, and spawn parameters per adapter

## Public API Surface

### Main Entry Points

**ProxyManager** - Primary integration point for external systems:
- `start(config: ProxyConfig): Promise<void>` - Spawns and initializes proxy process
- `sendDapRequest(command: string, args?: any): Promise<any>` - Routes DAP commands with Promise-based responses
- `stop(): Promise<void>` - Graceful shutdown with timeout fallback

**ProxyConfig Interface** - Language-agnostic proxy configuration:
- Session identification, debug adapter network configuration, script paths, breakpoint setup
- Language-specific launch parameters and optional adapter command specification

**Event System** - Comprehensive event emission for DAP events, lifecycle changes, and error notifications:
- DAP events: stopped, continued, thread, output, exited, terminated
- Lifecycle events: ready, error, exit with detailed status information

### Secondary Entry Points

**DAP Proxy Components** (re-exported via `dap-proxy.ts`):
- `ProxyRunner` - Direct proxy execution for programmatic control
- `DapProxyWorker` - Worker implementation for advanced integration scenarios
- `MessageParser` - Message parsing utilities for custom IPC scenarios

## Internal Organization and Data Flow

### Initialization Flow
1. **ProxyManager.start()** validates environment and spawns proxy process via `proxy-bootstrap.js`
2. **Bootstrap script** sets up orphan detection, signal handling, and dynamically loads proxy implementation
3. **ProxyRunner** establishes IPC/stdin communication channels with heartbeat monitoring
4. **DapProxyWorker** receives init commands, spawns debug adapters, and establishes DAP connections

### Request Processing Pipeline
1. **ProxyManager** receives DAP requests from clients
2. **Request routing** through policy-driven decision making (parent vs child session)
3. **Command queueing** when adapters require sequential processing
4. **MinimalDapClient** handles TCP communication with proper buffer management
5. **Response correlation** with timeout tracking and cleanup

### Multi-Session Coordination
1. **Policy evaluation** determines when child sessions are needed
2. **ChildSessionManager** creates and configures child DAP clients
3. **Event forwarding** and **breakpoint mirroring** between parent and child sessions
4. **Request routing** based on policy configuration and session availability

## Important Patterns and Conventions

### Dependency Injection Architecture
- Comprehensive dependency injection for testability and modularity
- Production dependencies factory (`createProductionDependencies`) provides concrete implementations
- Interface-based abstractions for file systems, process spawning, logging, and message sending

### State Machine Management
- **ProxyState enum** tracking proxy lifecycle with clear state transitions
- **Adapter-specific state** management through policy system
- **Connection state** synchronization between proxy and debug adapters

### Error Handling and Resilience
- **Retry logic** with exponential backoff for connection establishment and initialization
- **Timeout management** preventing hanging operations across all communication layers
- **Graceful degradation** when child sessions become unavailable
- **Orphan detection** with container-aware process management

### Process Lifecycle Management
- **Signal handling** for graceful shutdown (SIGTERM/SIGINT)
- **Heartbeat monitoring** for detecting communication loss with parent processes
- **Resource cleanup** ensuring proper disposal of connections, timers, and child processes
- **Container-aware orphan detection** handling modern deployment scenarios

The proxy module serves as the critical bridge between high-level debugging interfaces and language-specific debug adapters, providing a robust, policy-driven, and multi-session capable debugging infrastructure.