# src\proxy/
@children-hash: 2042252c72fa80f2
@generated: 2026-02-15T09:01:45Z

## Overall Purpose and Responsibility

The `src/proxy` directory implements a sophisticated Debug Adapter Protocol (DAP) proxy system that bridges between debug MCP servers and actual language debuggers. It provides a complete middleware layer for debugging communication, featuring multi-session support, policy-driven adapter behavior, and robust process lifecycle management.

## Key Components and Architecture

### Core Proxy System
- **ProxyManager** (`proxy-manager.ts`) - Main orchestrator that spawns and manages proxy processes, handles DAP message routing with timeout management
- **DapProxyWorker** (`dap-proxy-worker.ts`) - Core worker implementation using Adapter Policy pattern to eliminate language-specific hardcoding
- **ProxyRunner** (`dap-proxy-core.ts`) - Pure business logic orchestrator supporting both IPC and stdin communication channels

### DAP Communication Layer  
- **MinimalDapClient** (`minimal-dap.ts`) - Sophisticated DAP protocol client with multi-session support, child session adoption, and VSCode-compatible message parsing
- **DapConnectionManager** (`dap-proxy-connection-manager.ts`) - Manages DAP connections with robust retry logic and session initialization
- **GenericAdapterManager** (`dap-proxy-adapter-manager.ts`) - Language-agnostic debug adapter process spawner and lifecycle manager

### Multi-Session Support
- **ChildSessionManager** (`child-session-manager.ts`) - Handles spawned debug sessions for complex debugging scenarios (e.g., JavaScript with js-debug/pwa-node)
- Advanced breakpoint mirroring, event forwarding, and concurrent session coordination

### Message Processing & State Management
- **MessageParser** (`dap-proxy-message-parser.ts`) - Type-safe parsing of IPC messages with comprehensive validation
- **RequestTracker** (`dap-proxy-request-tracker.ts`) - Request timeout management with callback support
- Comprehensive type system in `dap-proxy-interfaces.ts` defining contracts for all components

### Process Lifecycle & Infrastructure  
- **Dependency Injection** (`dap-proxy-dependencies.ts`) - Production dependency factory for testability
- **Process Bootstrap** (`proxy-bootstrap.js`) - Robust startup script with orphan detection and heartbeat monitoring  
- **Signal Debugging** (`signal-debug.ts`) - Comprehensive process termination diagnostics
- **Utilities** (`utils/`) - Container-aware orphan detection for modern deployment scenarios

## Public API Surface

### Main Entry Points
- `ProxyManager` class - Primary interface for spawning and controlling proxy processes
- `ProxyConfig` interface - Configuration structure for proxy initialization  
- `IProxyManager` interface - Contract for proxy management operations
- `ProxyRunner` - Direct proxy execution without auto-startup side effects

### Key Methods
- `ProxyManager.start(config: ProxyConfig)` - Spawn proxy with language-specific configuration
- `ProxyManager.sendDapRequest(command, args)` - Route DAP commands with Promise-based responses
- `ProxyManager.stop()` - Graceful shutdown with timeout fallback
- `ProxyRunner.start()` - Initialize proxy with configurable communication channels

### Event System
- Comprehensive event emission via `ProxyManagerEvents` interface
- DAP event forwarding (stopped, continued, thread, output, etc.)
- Lifecycle events (proxy started, failed, exited)
- Multi-session event aggregation and forwarding

## Internal Organization and Data Flow

### Initialization Flow  
1. `ProxyManager` spawns proxy process via `proxy-bootstrap.js`
2. Bootstrap script loads appropriate proxy implementation (`dap-proxy-entry.ts`)
3. `ProxyRunner` initializes with production dependencies
4. `DapProxyWorker` receives init command and selects appropriate `AdapterPolicy`
5. Generic adapter manager spawns language-specific debugger
6. Connection manager establishes DAP communication with retry logic

### Message Routing Architecture
- Commands flow: Client → ProxyManager → DapProxyWorker → MinimalDapClient → Debug Adapter
- Responses flow: Debug Adapter → MinimalDapClient → DapProxyWorker → ProxyManager → Client  
- Multi-session scenarios involve ChildSessionManager for concurrent session coordination
- Policy-driven routing decisions based on adapter-specific requirements

### State Management
- Functional core state management via `@debugmcp/shared` package
- Request correlation and timeout tracking via RequestTracker classes  
- Process lifecycle tracking through ProxyState enum
- Thread and session state coordination across multiple debug targets

## Important Patterns and Conventions

### Adapter Policy Pattern
- Eliminates hardcoded language-specific behavior through pluggable policy system
- Policies control child session routing, command queuing, state management
- Supports JavaScript, Python, Rust, Go debuggers with extensible architecture

### Dependency Injection & Testability
- All external dependencies abstracted through interfaces
- Production dependency factory provides concrete implementations
- Clean separation enables comprehensive testing without external process dependencies

### Robust Error Handling & Recovery
- Comprehensive timeout handling with exponential backoff
- Graceful degradation when optional operations fail
- Container-aware orphan detection for modern deployment scenarios  
- Detailed diagnostic logging and signal debugging capabilities

### Communication Resilience
- Dual-channel support (IPC preferred, stdin/readline fallback)
- Heartbeat monitoring and connection loss detection
- Request deduplication and proper cleanup on failures
- Buffer management compatible with VSCode DAP implementation

This proxy system enables seamless debugging across multiple languages while maintaining clean abstractions, robust error handling, and support for complex multi-session debugging scenarios.