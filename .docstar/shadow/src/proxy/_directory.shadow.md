# src/proxy/
@generated: 2026-02-10T01:19:54Z

## Overall Purpose and Responsibility

The `src/proxy` directory implements a comprehensive Debug Adapter Protocol (DAP) proxy system that acts as an intermediary layer between debug clients and language-specific debug adapters. The proxy enables multi-session debugging, provides language-agnostic adapter management, and implements sophisticated policy-driven behavior customization. It serves as the core infrastructure for the MCP Debugger's ability to manage complex debugging scenarios across multiple programming languages.

## Key Components and Relationships

**Core Orchestration Layer:**
- `ProxyManager` - Main client-facing interface that spawns and communicates with proxy processes via EventEmitter pattern
- `DapProxyWorker` - Core worker implementation handling DAP session lifecycle, command routing, and adapter policy enforcement
- `ProxyRunner` - Pure business logic runner managing communication channels (IPC/stdin) and process lifecycle

**Multi-Session Debug Management:**
- `MinimalDapClient` - Sophisticated DAP protocol client with child session adoption and policy-driven routing
- `ChildSessionManager` - Manages spawned debug sessions for complex scenarios like JavaScript debugging with concurrent sessions
- Policy-based command routing and breakpoint mirroring between parent and child sessions

**Adapter Integration:**
- `GenericAdapterManager` - Language-agnostic debug adapter process spawner and lifecycle manager  
- `DapConnectionManager` - Handles DAP socket connections with robust retry logic and graceful cleanup
- Adapter Policy pattern enabling customization for different languages (JS/Node, Python, Java, Rust, Go)

**Communication Infrastructure:**
- Message parsing and validation system with typed command interfaces
- Request tracking with timeout management and cleanup
- Dual communication channels (IPC preferred, stdin fallback) with heartbeat monitoring

**Process Management:**
- Bootstrap system with orphan detection and signal handling
- Container-aware process lifecycle management
- Comprehensive error handling and graceful shutdown mechanisms

## Public API Surface

**Primary Entry Points:**
- `ProxyManager` class - Main interface for spawning and controlling debug proxy processes
- `ProxyConfig` interface - Configuration for language-agnostic proxy startup
- `ProxyManagerEvents` interface - Typed event system for DAP lifecycle and proxy status events

**Key Methods:**
- `ProxyManager.start(config)` - Spawns proxy process with language-specific configuration
- `ProxyManager.sendDapRequest(command, args)` - Routes DAP commands with request correlation
- Event handlers for `stopped`, `continued`, `terminated`, `initialized`, `error`, `exit`, `dry-run-complete`

**Worker Process APIs:**
- `DapProxyWorker` - Core worker with dependency injection for testing
- `ProxyRunner` - Execution engine with configurable communication options
- Bootstrap entry points for production deployment

## Internal Organization and Data Flow

**Layered Architecture:**
1. **Client Interface Layer** - ProxyManager provides EventEmitter-based API to debug clients
2. **Process Management Layer** - Spawning, lifecycle management, and communication setup
3. **Protocol Layer** - DAP message routing, request correlation, and multi-session handling  
4. **Adapter Layer** - Language-specific adapter spawning and policy enforcement
5. **Transport Layer** - Socket connections, message parsing, and buffer management

**State Synchronization:**
- Dual state management with functional core (dap-core integration) and imperative local state
- Request tracking across proxy boundaries with UUID correlation
- Thread context maintenance and breakpoint mirroring

**Communication Flow:**
1. Client sends commands to ProxyManager
2. ProxyManager forwards to spawned proxy worker via IPC
3. Worker routes commands through policy system to appropriate adapter
4. DAP responses flow back through the same chain with event emission
5. Multi-session scenarios trigger child session creation and command routing

## Important Patterns and Conventions

**Policy-Driven Architecture:** Adapter policies encapsulate language-specific behavior, enabling extensible support for new debugging languages without core system changes.

**Dependency Injection:** Comprehensive DI system enables testing and modularity, with production and test dependency factories.

**Container-Aware Design:** Orphan detection and process management handle containerized deployment scenarios correctly.

**Event-Driven Communication:** EventEmitter pattern throughout enables loose coupling and reactive programming patterns.

**Graceful Degradation:** Robust error handling, timeout management, and fallback mechanisms ensure system stability even when individual components fail.

**Multi-Session Coordination:** Sophisticated session management enables complex debugging scenarios like JavaScript with multiple concurrent debug sessions.

The proxy system serves as the foundational infrastructure enabling the MCP Debugger to provide a unified debugging experience across multiple programming languages while handling the complexity of modern debugging scenarios.