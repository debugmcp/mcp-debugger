# src/
@generated: 2026-02-10T01:20:27Z

## Overall Purpose and Responsibility

The `src` directory contains the complete implementation of the Debug MCP (Model Context Protocol) Server - a comprehensive debugging platform that bridges AI agents with development environments through standardized MCP protocols. This system enables AI assistants to debug code across multiple programming languages by exposing debugging capabilities as MCP tools, supporting everything from basic breakpoints to complex multi-session debugging scenarios.

## Core Architecture and Component Integration

### Layered System Design

The architecture follows a sophisticated dependency injection pattern with clear separation of concerns:

**1. Foundation Layer**
- **Container** (`container/`): Dependency injection system providing centralized configuration and service wiring
- **Interfaces** (`interfaces/`): Complete abstraction layer defining contracts for all system components
- **Implementations** (`implementations/`): Concrete Node.js-based implementations of all interfaces
- **Utils** (`utils/`): Shared utilities for path resolution, logging, file operations, and environment handling

**2. Protocol and Communication Layer**
- **Server** (`server.ts`): Main MCP server exposing 20+ debugging tools via JSON Schema to AI agents
- **DAP Core** (`dap-core/`): Functional, stateless Debug Adapter Protocol message processing engine
- **Proxy** (`proxy/`): Sophisticated DAP proxy system managing multi-session debugging and adapter lifecycle

**3. Domain Logic Layer**
- **Session** (`session/`): Complete debug session lifecycle management with data operations and state coordination
- **Adapters** (`adapters/`): Dynamic adapter discovery, loading, and registry management for language support
- **Factories** (`factories/`): Factory pattern implementations for creating core service instances

**4. Infrastructure Layer**
- **CLI** (`cli/`): Multi-transport command-line interface supporting stdio, SSE, and binary analysis modes
- **Errors** (`errors/`): Comprehensive typed error hierarchy with MCP protocol compliance
- **Entry Point** (`index.ts`): Application bootstrap with console silencing and container diagnostics

## Key Entry Points and Public API Surface

### Primary Entry Points

**Main Application Bootstrap:**
- `index.ts`: Application entry point with `createDebugMcpServer()` factory and CLI command setup
- `server.ts`: `DebugMcpServer` class implementing complete MCP protocol with debugging tools

**CLI Interface:**
- `cli/setup.ts`: `createCLI()` factory for command-line interface configuration
- Multi-transport support: stdio (default), SSE (web-based), and binary analysis modes

**Service Factories:**
- `container/dependencies.ts`: `createProductionDependencies()` for complete dependency graph
- `session/SessionManager.ts`: Main session management interface
- `adapters/adapter-registry.ts`: `getAdapterRegistry()` singleton for adapter lifecycle

### MCP Protocol Integration

**Tool Exposure:**
- 20+ debugging tools exposed through MCP protocol including session management, breakpoints, stepping, variable inspection, and expression evaluation
- Dynamic tool schema generation based on available language adapters
- Structured JSON responses for all debugging operations

**Language Support:**
- Dynamic adapter discovery and loading for Python, Node.js, Java, Rust, Go, and mock debugging
- Container-aware deployment with special handling for MCP_CONTAINER environments
- Language-specific policies and behavior customization

## Internal Organization and Data Flow

### Component Orchestration

**1. Initialization Flow:**
```
index.ts → Dependencies Container → Server Creation → Adapter Registry Setup → CLI Command Registration
```

**2. Debug Session Flow:**
```
MCP Tool Request → Server Validation → Session Manager → Proxy Manager → DAP Adapter → Target Process
```

**3. Multi-Session Coordination:**
```
Client Session → Proxy Worker → Multiple Child Sessions → Policy-Based Command Routing → Adapter Management
```

### State Management Philosophy

- **Functional Core**: Pure state transformations in dap-core with command-based side effects
- **Imperative Shell**: Session managers handle I/O operations and lifecycle management  
- **Event-Driven**: EventEmitter patterns throughout for loose coupling and reactivity
- **Immutable State**: Defensive copying and readonly properties where applicable

### Cross-Cutting Concerns

**Environment Adaptation:**
- Container vs host deployment detection through `MCP_CONTAINER` environment variable
- Path resolution abstraction handling container volume mounts and host filesystem differences
- Console output management to prevent MCP protocol corruption

**Error Handling:**
- Comprehensive typed error hierarchy extending MCP base error classes
- Graceful degradation with structured error responses rather than exceptions
- Recovery strategy detection for retry logic

**Resource Management:**
- Auto-dispose mechanisms with configurable timeouts for adapter cleanup
- Memory leak prevention through WeakMap event handlers and explicit cleanup
- Process lifecycle management with orphan detection and signal handling

## Critical Integration Patterns

**Dependency Injection:** Complete DI container enabling testability, modularity, and flexible configuration across different deployment scenarios.

**Adapter Pattern:** Language-agnostic debugging through dynamic adapter loading with policy-based behavior customization.

**Protocol Abstraction:** Clean separation between MCP protocol handling and underlying DAP communication, enabling multiple transport mechanisms.

**Multi-Session Architecture:** Sophisticated proxy system supporting complex debugging scenarios like JavaScript with concurrent debug sessions.

The `src` directory represents a production-ready, enterprise-grade debugging platform that successfully abstracts the complexity of multi-language debugging while providing a clean, standardized interface for AI agent integration through the Model Context Protocol.