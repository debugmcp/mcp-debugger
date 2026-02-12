# src/proxy/
@generated: 2026-02-11T23:48:00Z

## Purpose and Responsibility

The `src/proxy` directory implements a comprehensive Debug Adapter Protocol (DAP) proxy system that acts as an intermediary layer between MCP debug servers and actual debug adapters. The proxy enables language-agnostic debugging by spawning and managing debug adapter processes, handling DAP message routing, and providing multi-session debugging capabilities with sophisticated state management.

## Key Components and Architecture

### Core Proxy Engine
- **dap-proxy-core.ts**: `ProxyRunner` class providing the main orchestration logic with dual communication channels (IPC/stdin)
- **dap-proxy-worker.ts**: `DapProxyWorker` implementing the actual proxy functionality using the Adapter Policy pattern for language-agnostic behavior
- **dap-proxy-entry.ts**: Production entry point with environment detection and auto-execution logic

### Process and Session Management  
- **proxy-manager.ts**: `ProxyManager` class orchestrating proxy process lifecycle, DAP message routing with timeout management, and state synchronization
- **child-session-manager.ts**: `ChildSessionManager` handling multi-session debugging scenarios, particularly for JavaScript debugging requiring concurrent sessions
- **dap-proxy-adapter-manager.ts**: `GenericAdapterManager` for spawning and managing debug adapter processes in a language-agnostic way

### Communication and Protocol Layer
- **minimal-dap.ts**: `MinimalDapClient` providing sophisticated DAP protocol client with multi-session support, child session adoption, and policy-driven behavior
- **dap-proxy-connection-manager.ts**: `DapConnectionManager` handling DAP connections with robust retry logic and session initialization
- **dap-proxy-message-parser.ts**: `MessageParser` utilities for parsing and validating IPC messages from parent processes

### Infrastructure and Support
- **dap-proxy-interfaces.ts**: Complete type system and dependency abstractions defining the proxy's communication protocol
- **dap-proxy-dependencies.ts**: Production dependency injection factory providing concrete implementations
- **dap-proxy-request-tracker.ts**: Request timeout management with callback support
- **proxy-bootstrap.js**: Bootstrap script handling process lifecycle, orphan detection, and dynamic proxy loading

## Public API Surface

### Main Entry Points
- **ProxyManager**: Primary orchestrator for spawning and managing proxy processes
- **ProxyRunner**: Core proxy execution engine for programmatic control
- **MinimalDapClient**: DAP client for direct protocol communication

### Configuration Interfaces
- **ProxyConfig**: Language-agnostic proxy startup parameters
- **ProxyInitPayload**: Complete initialization command structure
- **AdapterConfig**: Debug adapter spawn configuration

### Communication Protocol
- **ParentCommand**: Union type for all incoming commands (init, DAP, terminate)
- **ProxyMessage**: Response message system (status, DAP responses, events, errors)

## Internal Organization and Data Flow

### Initialization Flow
1. **Proxy Manager** spawns proxy process via bootstrap script
2. **Bootstrap** detects environment, loads appropriate proxy implementation
3. **Proxy Worker** receives initialization, selects adapter policy based on language
4. **Adapter Manager** spawns debug adapter process
5. **Connection Manager** establishes DAP communication with retry logic

### Runtime Message Flow
1. DAP commands from MCP server → **Proxy Manager**
2. IPC routing → **Proxy Worker**  
3. Policy-driven processing → **DAP Client**
4. Protocol communication → Debug Adapter
5. Responses/events flow back through the same chain

### Multi-Session Architecture
For complex debugging scenarios (particularly JavaScript):
1. **Child Session Manager** detects need for additional sessions
2. Spawns child DAP clients with modified policies
3. Routes specific commands to appropriate child sessions
4. Mirrors breakpoints and forwards events between sessions

## Important Patterns and Conventions

### Adapter Policy Pattern
The system uses pluggable **AdapterPolicy** implementations to eliminate language-specific hardcoding. Policies control:
- Command queueing behavior
- Child session creation logic  
- State transition handling
- Request routing decisions

### Dependency Injection
Comprehensive DI system enables testing and modularity:
- **DapProxyDependencies**: Complete dependency container
- Factory pattern for configurable component creation
- Interface abstractions for all external dependencies

### State Management
- **ProxyState** enum for lifecycle management
- Request tracking with timeout handling
- Command queueing for proper DAP sequencing
- Graceful shutdown with escalating termination signals

### Error Handling and Reliability
- Extensive retry logic with exponential backoff
- Timeout protection on all DAP operations
- Orphan detection with container-awareness
- Comprehensive logging and diagnostics
- Graceful degradation when components fail

The proxy system provides a robust, language-agnostic debugging infrastructure that handles the complexity of DAP protocol management while providing clean abstractions for the MCP debug server layer.