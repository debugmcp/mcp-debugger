# src/proxy/
@generated: 2026-02-10T21:26:44Z

## Purpose and Responsibility

The `src/proxy` directory implements a comprehensive Debug Adapter Protocol (DAP) proxy system that bridges between debug clients and language-specific debug adapters. This proxy layer provides language-agnostic debugging capabilities, multi-session support, and robust process management for the MCP Debug system. The proxy acts as an intelligent intermediary that can spawn debug adapters, manage DAP communication, handle child session adoption, and provide policy-driven behavior customization.

## Key Components and Architecture

### Core Orchestration Layer
- **ProxyManager** (`proxy-manager.ts`): Main orchestrator managing proxy process lifecycle, DAP message routing, and state synchronization
- **DapProxyWorker** (`dap-proxy-worker.ts`): Core worker implementing the full debugging lifecycle with adapter policy pattern
- **ProxyRunner** (`dap-proxy-core.ts`): Pure business logic for proxy execution with dual communication channels (IPC/stdin)

### Protocol and Communication
- **MinimalDapClient** (`minimal-dap.ts`): Sophisticated DAP client with multi-session support, child session adoption, and VSCode-compatible message parsing
- **DapConnectionManager** (`dap-proxy-connection-manager.ts`): Manages DAP connections with robust retry logic and session initialization
- **MessageParser** (`dap-proxy-message-parser.ts`): Pure message parsing utilities for IPC command validation and routing

### Multi-Session Management
- **ChildSessionManager** (`child-session-manager.ts`): Handles child debug sessions for complex debugging scenarios (e.g., JavaScript with js-debug/pwa-node requiring concurrent sessions)
- **RequestTracker** (`dap-proxy-request-tracker.ts`): Manages DAP request timeouts and lifecycle tracking

### Process and Lifecycle Management
- **GenericAdapterManager** (`dap-proxy-adapter-manager.ts`): Language-agnostic debug adapter process spawning and management
- **proxy-bootstrap.js**: Bootstrap script with orphan detection, signal handling, and heartbeat monitoring
- **signal-debug.ts**: Comprehensive signal debugging and process termination diagnostics

### Configuration and Dependencies
- **ProxyConfig** (`proxy-config.ts`): Language-agnostic configuration interface for proxy startup
- **DapProxyDependencies** (`dap-proxy-dependencies.ts`): Production dependency injection factory
- **Interfaces** (`dap-proxy-interfaces.ts`): Complete type system and dependency abstractions

## Public API Surface

### Main Entry Points
- `ProxyManager`: Primary interface for spawning and managing proxy processes
- `ProxyConfig`: Configuration interface for proxy initialization
- `IProxyManager` & `ProxyManagerEvents`: Contract and event system for proxy lifecycle
- `ProxyRunner`: Core execution engine for programmatic use
- `MinimalDapClient`: DAP client implementation for direct protocol interaction

### Key Configuration Types
- `ProxyConfig`: Complete proxy startup configuration
- `ProxyInitPayload`: Worker initialization command structure
- `DapCommandPayload`: DAP command forwarding wrapper
- `AdapterConfig`: Debug adapter spawn configuration

## Internal Organization and Data Flow

### Proxy Lifecycle Flow
1. **Initialization**: ProxyManager spawns proxy process via bootstrap script
2. **Worker Setup**: DapProxyWorker initializes with adapter policy selection
3. **Adapter Spawning**: GenericAdapterManager launches language-specific debug adapter
4. **DAP Connection**: DapConnectionManager establishes protocol communication
5. **Session Management**: ChildSessionManager handles multi-session scenarios
6. **Command Routing**: Message parsing and policy-driven command forwarding
7. **Cleanup**: Graceful shutdown with resource cleanup and process termination

### Communication Architecture
- **Dual Channel Support**: IPC preferred, stdin/readline fallback
- **Request Correlation**: Timeout-based request tracking with automatic cleanup
- **Event Forwarding**: Comprehensive DAP event routing between sessions
- **Error Recovery**: Retry logic, graceful degradation, and orphan detection

### Policy-Driven Behavior
- **Adapter Policies**: Language-specific behavior encapsulation (JavaScript, Python, Java, etc.)
- **Command Queueing**: Policy-controlled message ordering and timing
- **Child Session Logic**: Configurable multi-session adoption strategies
- **State Management**: Policy-aware debugging state transitions

## Important Patterns and Conventions

### Adapter Policy Pattern
Eliminates hardcoded language-specific logic through policy objects that control:
- Command routing and queueing decisions
- Child session creation and adoption
- Adapter-specific initialization sequences
- Debug state management strategies

### Multi-Session Architecture
Sophisticated support for debugging scenarios requiring multiple concurrent sessions:
- Parent-child session relationships
- Breakpoint mirroring across sessions
- Event forwarding and state synchronization
- Policy-driven session adoption

### Dependency Injection Design
Clean separation of concerns through comprehensive DI:
- External dependencies abstracted via interfaces
- Production vs test configurations
- Modular component composition
- Enhanced testability and maintainability

### Container-Aware Process Management
Robust process lifecycle management with container support:
- Orphan detection with container awareness (`MCP_CONTAINER` environment variable)
- Signal handling and graceful shutdown
- Heartbeat monitoring and parent process tracking
- Cross-platform process termination strategies

### Error Recovery and Robustness
Comprehensive error handling throughout the stack:
- Retry logic with exponential backoff
- Timeout protection on all async operations
- Graceful degradation when optional features fail
- Resource cleanup in error scenarios

The proxy system provides a production-ready foundation for multi-language debugging with sophisticated session management, robust process handling, and flexible policy-driven behavior customization.