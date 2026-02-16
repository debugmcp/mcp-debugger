# src\proxy/
@children-hash: cf517d60847de8ed
@generated: 2026-02-16T08:24:42Z

## Overall Purpose and Responsibility

The `src/proxy` directory implements a comprehensive Debug Adapter Protocol (DAP) proxy system that enables the MCP Debug Server to communicate with various language debuggers. The proxy acts as an intelligent intermediary, spawning and managing debug adapter processes while providing language-agnostic debugging capabilities with support for multi-session debugging, child session adoption, and policy-driven adapter behavior.

## Key Components and Architecture

### Core Orchestration Layer
- **ProxyManager** (`proxy-manager.ts`) - Main entry point that manages proxy process lifecycle, DAP message routing, and timeout handling. Extends EventEmitter for async communication.
- **ProxyRunner** (`dap-proxy-core.ts`) - Pure business logic orchestrator supporting both IPC and stdin communication channels with heartbeat monitoring.
- **DapProxyWorker** (`dap-proxy-worker.ts`) - Core worker implementing language-agnostic DAP proxy using the Adapter Policy pattern to eliminate hardcoded language logic.

### Protocol and Communication
- **MinimalDapClient** (`minimal-dap.ts`) - Sophisticated DAP client with multi-session support, child session adoption, and VSCode-compatible message parsing.
- **MessageParser** (`dap-proxy-message-parser.ts`) - Pure functions for parsing and validating IPC messages from parent processes into typed commands.
- **Type System** (`dap-proxy-interfaces.ts`) - Complete type definitions for DAP proxy system with dependency injection abstractions.

### Process and Session Management
- **ChildSessionManager** (`child-session-manager.ts`) - Manages child debug sessions for multi-session debugging (e.g., JavaScript with js-debug/pwa-node).
- **GenericAdapterManager** (`dap-proxy-adapter-manager.ts`) - Language-agnostic debug adapter process spawner and lifecycle manager.
- **DapConnectionManager** (`dap-proxy-connection-manager.ts`) - DAP connection management with robust retry logic and session initialization.

### Infrastructure and Utilities
- **RequestTracker** (`dap-proxy-request-tracker.ts`) - DAP request timeout management with callback support.
- **Bootstrap** (`proxy-bootstrap.js`) - Process initialization script with orphan detection and dynamic proxy loading.
- **Dependencies** (`dap-proxy-dependencies.ts`) - Production dependency injection factory for worker isolation.
- **Utils** (`utils/`) - Container-aware orphan detection utilities for proxy process stability.

## Public API Surface

### Main Entry Points
- **`ProxyManager`** - Primary API for spawning and controlling debug proxy processes
- **`ProxyRunner`** - Direct proxy execution engine for programmatic control
- **`DapProxyWorker`** - Core worker class for proxy operations
- **`MinimalDapClient`** - DAP client for direct debugging communication

### Configuration Interfaces
- **`ProxyConfig`** - Language-agnostic proxy startup configuration
- **`ProxyRunnerOptions`** - Communication preferences and message handling options
- **`ProxyManagerEvents`** - Typed event system for DAP events and lifecycle notifications

## Internal Organization and Data Flow

### Initialization Flow
1. **ProxyManager** spawns proxy process using **proxy-bootstrap.js**
2. **Bootstrap** detects execution mode and loads appropriate proxy implementation
3. **ProxyRunner** establishes IPC/stdin communication channels with heartbeat monitoring
4. **DapProxyWorker** initializes with policy-driven adapter selection and spawning
5. **DapConnectionManager** establishes DAP connection with retry logic

### Message Processing Pipeline
1. Parent process sends commands via **ProxyManager**
2. **MessageParser** validates and routes commands in worker process
3. **DapProxyWorker** executes commands using policy-driven behavior
4. **MinimalDapClient** handles DAP protocol communication with adapters
5. Responses flow back through IPC to **ProxyManager** event system

### Multi-Session Architecture
- **ChildSessionManager** coordinates spawning of additional debug sessions
- **MinimalDapClient** routes commands between parent and child sessions based on policy
- Breakpoint mirroring and event forwarding between sessions
- Policy-driven decision making for command routing and session management

## Important Patterns and Conventions

### Policy-Driven Architecture
Uses **Adapter Policy pattern** to eliminate language-specific hardcoding, with pluggable policies defining initialization sequences, command queueing rules, and multi-session behavior.

### Dependency Injection
Comprehensive dependency injection throughout with interfaces for all external dependencies (filesystem, process spawning, logging) enabling testing and modularity.

### Request/Response Correlation
Sophisticated request tracking with configurable timeouts, automatic cleanup, and correlation between DAP commands and responses across multiple sessions.

### Container-Aware Process Management
Intelligent orphan detection that handles both host and containerized environments correctly, preventing zombie processes while supporting modern deployment scenarios.

### Graceful Error Handling
Extensive error handling with retry logic, timeout protection, graceful degradation, and comprehensive logging for debugging multi-session scenarios.

The proxy system enables the MCP Debug Server to provide unified debugging capabilities across multiple languages while maintaining clean separation of concerns and robust process lifecycle management.