# src/
@generated: 2026-02-09T18:17:04Z

## Overall Purpose and Responsibility

The `src` directory serves as the complete implementation of the Debug MCP (Model Context Protocol) Server - a comprehensive debugging platform that provides language-agnostic debugging capabilities through MCP protocol compliance. This directory implements a sophisticated architecture that bridges VSCode-compatible debug clients with various language-specific debug adapters (Python, JavaScript, Java, Rust, etc.) while maintaining protocol safety and supporting multiple deployment environments including containers and standalone installations.

## Key Components and System Architecture

### Core Server Infrastructure
- **`index.ts`** - Primary entry point that handles environment initialization, console silencing for MCP protocol safety, CLI bootstrapping, and module detection
- **`server.ts`** - Main MCP server implementation (`DebugMcpServer`) that orchestrates debug sessions, provides 18+ debugging tools, and manages dynamic language discovery
- **`container/`** - Dependency injection system serving as composition root with production-ready service wiring and dynamic adapter loading

### Debug Adapter Protocol (DAP) System
- **`proxy/`** - Comprehensive DAP proxy system with `DapProxyWorker` orchestration, multi-session management, and policy-driven language support
- **`dap-core/`** - Functional, stateless DAP message processing with immutable state management and command-based side effects
- **`adapters/`** - Dynamic adapter loading and registry system with runtime discovery and lifecycle management

### Session & Process Management
- **`session/`** - Layered session management with `SessionManager` facade, execution control, data retrieval, and comprehensive lifecycle orchestration
- **`implementations/`** - Production-ready concrete implementations of system abstractions (filesystem, networking, process management) with Node.js platform integration

### Supporting Infrastructure
- **`cli/`** - Commander.js-based CLI framework supporting stdio and Server-Sent Events transport modes with global error handling
- **`interfaces/`** - Comprehensive interface definitions enabling dependency injection, testing isolation, and platform abstraction
- **`factories/`** - Factory pattern implementations for `ProxyManager` and `SessionStore` creation with test double support
- **`errors/`** - Typed error hierarchy extending `McpError` with semantic classification and recovery intelligence
- **`utils/`** - Cross-cutting utilities for logging, path resolution, type validation, and environment management

## Public API Surface

### Primary Entry Points
- **`createDebugMcpServer(options)`** - Main factory function for server instantiation
- **`main()`** - CLI orchestrator with transport mode configuration (stdio, SSE)
- **`SessionManager`** - Complete debug session management interface with execution control and data retrieval
- **`ProxyManager`** - High-level DAP proxy controller for spawning and managing debug processes

### MCP Tool Interface
The server exposes 18+ standardized MCP tools including:
- Session management: `create_debug_session`, `close_debug_session`
- Execution control: `start_debugging`, `continue_execution`, `step_over`, `step_into`, `step_out`
- Data inspection: `get_stack_trace`, `get_variables`, `get_local_variables`
- Breakpoint management: `set_breakpoint`, `remove_breakpoint`
- Process management: `attach_to_process`, `detach_from_process`

### Configuration Interfaces
- **`ServerOptions`** - Server-level configuration (logging, file output)
- **`ProxyConfig`** - Debug session configuration (adapters, scripts, breakpoints)
- **`ContainerConfig`** - Container-wide dependency configuration

## Internal Organization and Data Flow

### Request Processing Pipeline
1. **MCP Protocol Layer** - Client requests arrive via stdio/SSE transports
2. **Tool Dispatch** - `DebugMcpServer` routes requests to appropriate handlers with validation
3. **Session Orchestration** - `SessionManager` coordinates debug operations through layered architecture
4. **Proxy Management** - DAP proxy system handles adapter communication and multi-session scenarios
5. **Adapter Integration** - Dynamic adapter loading connects to language-specific debug backends
6. **Response Assembly** - Results flow back through MCP protocol with structured error handling

### Component Interaction Flow
```
MCP Client (CLI/Transport)
    ↓ (MCP protocol)
DebugMcpServer (tool dispatch)
    ↓ (session operations)
SessionManager (lifecycle coordination) 
    ↓ (proxy management)
ProxyManager (DAP communication)
    ↓ (adapter integration)
Debug Adapters (language-specific)
```

### State Management Architecture
- **Session State** - Managed through `SessionStore` with dual legacy/new state models
- **Proxy State** - Handled via `dap-core` functional state transformations
- **Adapter Registry** - Dynamic loading with caching and lifecycle tracking
- **Dependency Container** - Centralized service composition with hierarchical injection

## Important Patterns and Conventions

### Protocol Safety and Transport Isolation
- **Console Silencing** - Immediate console output prevention to avoid MCP protocol corruption
- **Transport Abstraction** - Clean separation between stdio and SSE transport modes
- **Error Serialization** - Safe error handling that maintains protocol compliance

### Language-Agnostic Architecture
- **Policy-Driven Behavior** - `AdapterPolicy` system eliminates hardcoded language logic
- **Dynamic Discovery** - Runtime language detection with container environment awareness
- **Pluggable Adapters** - Extensible adapter system supporting new languages without core changes

### Production Readiness
- **Dependency Injection** - Comprehensive DI system enabling testing and modularity
- **Container Support** - First-class containerized deployment with path resolution and environment detection
- **Error Recovery** - Typed error hierarchy with recoverability classification
- **Resource Management** - Proper cleanup, timeout handling, and lifecycle management throughout

### Development Experience
- **Factory Patterns** - Consistent object creation with test double support
- **Interface Segregation** - Clean abstractions enabling comprehensive unit testing
- **Event-Driven Design** - EventEmitter-based loose coupling for session and proxy lifecycle
- **Structured Logging** - Winston-based logging with namespace organization and environment awareness

The `src` directory represents a complete, production-ready debugging platform that successfully bridges the gap between MCP protocol compliance and practical multi-language debugging needs while maintaining architectural cleanliness and extensive testing capabilities.