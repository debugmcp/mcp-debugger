# src\proxy/
@children-hash: 3ed8a720b3f937a1
@generated: 2026-02-19T23:48:23Z

## Overall Purpose

The `src/proxy` directory implements a comprehensive Debug Adapter Protocol (DAP) proxy system that bridges between debugging clients and language-specific debug adapters. This proxy layer enables unified debugging across multiple programming languages while handling complex multi-session scenarios, particularly for JavaScript debugging with js-debug/pwa-node that requires concurrent parent-child session management.

## Key Components and Architecture

### Core Proxy Infrastructure
- **ProxyManager** (`proxy-manager.ts`): Main orchestrator that spawns and manages proxy child processes, handles DAP command routing, and maintains session lifecycle
- **ProxyRunner** (`dap-proxy-core.ts`): Pure business logic for proxy execution with dual communication channels (IPC/stdin) and heartbeat monitoring
- **DapProxyWorker** (`dap-proxy-worker.ts`): Worker thread implementation that bridges DAP clients and debug adapters using adapter policies to eliminate language-specific hardcoding

### Multi-Session Debugging System
- **ChildSessionManager** (`child-session-manager.ts`): Manages concurrent debug sessions for JavaScript debugging scenarios, handling child session lifecycle, breakpoint mirroring, and event forwarding
- **MinimalDapClient** (`minimal-dap.ts`): Sophisticated DAP client with child session adoption, reverse request handling, and policy-driven behavior configuration

### Protocol and Message Management
- **Message Processing**: Type-safe message parsing (`dap-proxy-message-parser.ts`), request tracking with timeouts (`dap-proxy-request-tracker.ts`), and comprehensive DAP protocol extensions (`dap-extensions.ts`)
- **Connection Management**: Robust DAP connection handling with retry logic (`dap-proxy-connection-manager.ts`) and generic adapter process management (`dap-proxy-adapter-manager.ts`)

### Configuration and Dependencies
- **Type System**: Complete dependency abstractions and configuration interfaces (`dap-proxy-interfaces.ts`) enabling dependency injection for testability
- **Configuration**: Language-agnostic proxy configuration (`proxy-config.ts`) supporting auto-discovery and explicit adapter specification
- **Dependencies**: Production dependency factory (`dap-proxy-dependencies.ts`) providing concrete implementations for worker isolation

## Public API Surface

### Main Entry Points
- **ProxyManager**: Primary interface for spawning and controlling proxy processes
  - `start(config: ProxyConfig)`: Initialize proxy with session configuration
  - `stop()`: Graceful proxy termination
  - `sendDapRequest<T>()`: Send DAP commands to debug adapter
- **ProxyRunner**: Direct proxy execution for programmatic use without auto-execution
- **Bootstrap System**: `proxy-bootstrap.js` provides robust process lifecycle management with orphan detection

### Configuration Interface
- **ProxyConfig**: Language-agnostic configuration supporting multiple debug languages with optional executable auto-discovery, breakpoint pre-configuration, and adapter command specification

## Internal Organization and Data Flow

### Proxy Lifecycle Flow
1. **Initialization**: ProxyManager spawns proxy process via bootstrap script
2. **Adapter Selection**: Policy-based adapter selection (JS/Python/Rust/Go) with specialized behavior
3. **DAP Connection**: Connection manager establishes TCP connection with retry logic
4. **Session Management**: For multi-session scenarios, ChildSessionManager handles concurrent sessions
5. **Command Processing**: DAP commands routed through worker with policy-driven queueing and timeout management
6. **Termination**: Graceful shutdown with process cleanup and resource management

### Message Flow Architecture
- **Inbound**: Parent process → Message Parser → Worker → Policy → Adapter
- **Outbound**: Adapter → Worker → Event Forwarding → Parent Process
- **Multi-Session**: Parent Session ↔ Child Session Manager ↔ Multiple Child Sessions

### State Management
- **Functional Core**: Pure DAP state transitions in functional style
- **Imperative Shell**: Process management, I/O, and lifecycle coordination
- **Request Correlation**: UUID-based tracking for async DAP operations with timeout handling

## Important Patterns and Conventions

### Policy-Driven Architecture
Adapter policies eliminate language-specific hardcoding by providing:
- Command queueing strategies for sequential vs parallel processing
- Initialization sequences (launch/attach/deferred launch patterns)
- Child session adoption rules for multi-session debugging

### Robust Process Management
- **Orphan Detection**: Container-aware process termination logic via utils/orphan-check
- **Signal Handling**: Comprehensive signal debugging with process tree capture
- **Heartbeat System**: Communication monitoring to detect stale parent processes
- **Graceful Degradation**: Timeout protection and fallback mechanisms throughout

### Dependency Injection Design
Complete abstraction of external dependencies (filesystem, process spawning, networking) enables:
- Comprehensive testing with mocked dependencies  
- Environment-specific behavior adaptation
- Clean separation between business logic and infrastructure concerns

This proxy system serves as a critical bridge in the MCP debugging architecture, providing unified access to multiple debug adapters while handling the complexities of modern debugging scenarios including multi-session JavaScript debugging, containerized deployments, and cross-language debugging workflows.