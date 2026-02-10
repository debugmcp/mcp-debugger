# src/proxy/
@generated: 2026-02-09T18:16:31Z

## Overview

The `src/proxy` directory implements a comprehensive Debug Adapter Protocol (DAP) proxy system that provides language-agnostic debugging capabilities by bridging between VSCode-compatible debug clients and various language-specific debug adapters. The proxy eliminates hard-coded language dependencies through a policy-driven architecture that supports JavaScript, Python, Java, Rust, and other debugging backends.

## Core Architecture

### Primary Components

**DapProxyWorker (`dap-proxy-worker.ts`)** - The central orchestration engine that manages the complete debugging session lifecycle. Handles initialization, command routing, adapter spawning, and multi-session coordination using adapter policies to determine language-specific behaviors.

**ProxyManager (`proxy-manager.ts`)** - High-level controller that spawns and manages proxy child processes, routes DAP requests/responses between clients and proxies, and provides event-driven integration points for consuming applications.

**MinimalDapClient (`minimal-dap.ts`)** - Simplified DAP client implementation supporting both single-adapter debugging and complex multi-session scenarios with child process debugging. Features vscode-compatible message parsing and policy-driven behavior configuration.

**ChildSessionManager (`child-session-manager.ts`)** - Specialized manager for spawning and coordinating child debug sessions in multi-session scenarios (e.g., js-debug/pwa-node), with sophisticated state tracking and breakpoint mirroring capabilities.

### Supporting Infrastructure

**Connection & Process Management:**
- `DapConnectionManager` - Handles DAP adapter connections with retry logic and session initialization
- `GenericAdapterManager` - Language-agnostic adapter process spawning and lifecycle management
- `RequestTracker` - Timeout management for pending DAP requests

**Communication Layer:**
- `MessageParser` - Structured message parsing and validation for proxy IPC
- `ProxyCore` - Entry point providing programmatic proxy execution without auto-execution side effects
- Bootstrap system (`proxy-bootstrap.js`) - Process initialization and orphan detection

## Public API Surface

### Main Entry Points

**ProxyManager** - Primary integration point for applications:
```typescript
const manager = new ProxyManager(dependencies);
await manager.start(config);
await manager.sendDapRequest(command);
```

**ProxyRunner** - Direct proxy execution for testing and programmatic use:
```typescript
const runner = new ProxyRunner(dependencies, options);
await runner.start();
```

### Configuration Interface

**ProxyConfig** - Unified configuration supporting all debug scenarios:
- Session management (`sessionId`, `language`)
- Adapter connection (`adapterHost`, `adapterPort`, `executablePath`)
- Script execution (`scriptPath`, `scriptArgs`)
- Debug behavior (`stopOnEntry`, `justMyCode`, `initialBreakpoints`)

## Internal Organization & Data Flow

### Proxy Lifecycle
1. **Bootstrap** - Process initialization, environment detection, orphan monitoring
2. **Worker Initialization** - Policy selection, logger creation, adapter spawning
3. **DAP Connection** - TCP connection establishment with retry logic
4. **Session Management** - Command routing, request tracking, event forwarding
5. **Multi-Session Coordination** - Child session spawning and breakpoint mirroring
6. **Graceful Shutdown** - Resource cleanup, process termination

### Policy-Driven Architecture
The system uses `AdapterPolicy` configuration to eliminate language-specific hardcoding:
- **Policy Selection** - Automatic policy selection based on adapter command/language
- **Behavior Configuration** - Command queuing, breakpoint mirroring, child session strategies
- **Request Routing** - Policy-driven decisions for single vs multi-session scenarios

### Message Protocol
Structured IPC communication between components:
- **Command Messages** - Initialization, DAP commands, termination
- **Response Messages** - Status updates, DAP responses, events, errors
- **Event Forwarding** - Real-time debugging events (stopped, continued, output, etc.)

## Key Patterns & Conventions

**Dependency Injection** - All external dependencies abstracted through interfaces enabling comprehensive testing and modularity.

**Event-Driven Architecture** - Extensive use of EventEmitter for loose coupling between proxy lifecycle, DAP events, and client integration.

**Multi-Session Support** - First-class support for debugging scenarios requiring multiple concurrent debug adapters with parent-child coordination.

**Error Resilience** - Comprehensive error handling with retry logic, timeouts, graceful degradation, and detailed diagnostics.

**Container Awareness** - Built-in support for containerized environments with proper orphan detection and process lifecycle management.

## Critical Capabilities

- **Language Agnostic** - Unified interface supporting JavaScript, Python, Java, Rust, and extensible to additional languages
- **Multi-Session Debugging** - Native support for complex debugging scenarios with child process spawning
- **Policy Configuration** - Adapter-specific behaviors without hardcoded language logic
- **Production Ready** - Robust error handling, timeout management, resource cleanup, and container support
- **VSCode Compatible** - Full DAP protocol compliance with vscode-compatible message parsing