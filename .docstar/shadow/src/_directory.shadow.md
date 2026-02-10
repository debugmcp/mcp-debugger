# src/
@generated: 2026-02-10T21:27:16Z

## Overall Purpose

The `src` directory implements the complete Debug MCP Server - a production-ready Model Context Protocol (MCP) server that enables AI agents to debug code across multiple programming languages (Python, JavaScript, Rust, Go, Java). This system provides step-through debugging capabilities through a clean MCP interface while handling the complexity of language-specific debug adapters, process management, and protocol translation behind the scenes.

## Core Architecture and Component Relationships

### Layered Architecture
The system follows a clean layered architecture with well-defined boundaries:

**Presentation Layer**: 
- `index.ts` - Main entry point with console output silencing and CLI routing
- `cli/` - Command-line interface with stdio/SSE transport modes

**Application Layer**:
- `server.ts` - Core MCP server exposing 20+ debugging tools to AI agents
- `session/` - High-level session management with DAP protocol orchestration

**Domain Layer**:
- `proxy/` - Debug Adapter Protocol proxy system bridging clients and language adapters
- `adapters/` - Dynamic adapter discovery and lifecycle management
- `dap-core/` - Pure functional DAP message processing engine

**Infrastructure Layer**:
- `implementations/` - Production Node.js implementations of all system abstractions
- `container/` - Dependency injection system wiring the complete application
- `utils/` - Foundation utilities for path resolution, logging, and cross-environment support

### Key Integration Patterns

**Dependency Injection Flow**: The `container/` module serves as the composition root, creating the complete dependency graph that flows through all layers via interface-based injection.

**Protocol Translation Pipeline**: 
1. MCP clients → `server.ts` (MCP protocol) 
2. `session/` (high-level debugging operations)
3. `proxy/` (DAP protocol bridge)
4. Language-specific debug adapters

**Dynamic Adapter System**: `adapters/` provides dynamic discovery and loading of language support, while `proxy/` handles the complex process management and protocol bridging for each language.

## Public API Surface

### Main Entry Points

**Primary Interface**:
- `index.ts` - Main entry point with `createDebugMcpServer()` factory and CLI setup
- `server.ts` - `DebugMcpServer` class implementing complete MCP debugging protocol

**CLI Commands**:
- `stdio` - Run MCP server over stdin/stdout (default, container-friendly)
- `sse` - Run MCP server over HTTP Server-Sent Events
- `check-rust-binary` - Analyze Rust binary debugging capabilities

**Core Debugging Tools** (via MCP):
- Session management: `createDebugSession`, `closeDebugSession`
- Execution control: `startDebugging`, `continueExecution`, `stepOver/Into/Out`
- Breakpoint management: `setBreakpoint`, `removeBreakpoint`
- Data inspection: `getVariables`, `getLocalVariables`, `getStackTrace`
- Expression evaluation: `evaluateExpression`
- Remote debugging: `attachToProcess`, `detachFromProcess`

### Configuration Interfaces

**Server Configuration**:
- `ServerOptions` - Log level and file configuration
- `ContainerConfig` - Container-specific settings and dependency configuration

**Transport Options**:
- `StdioOptions` - Standard input/output transport configuration  
- `SSEOptions` - HTTP/SSE transport with port configuration

## Key System Capabilities

### Multi-Language Support
- **Dynamic Discovery**: Automatic detection of available language adapters
- **Extensible Architecture**: Plugin-style adapter loading with factory pattern
- **Policy-Driven Behavior**: Language-specific debugging behaviors through adapter policies

### Cross-Environment Deployment
- **Container-Aware**: Special handling for Docker environments (`MCP_CONTAINER=true`)
- **Path Resolution**: Intelligent path mapping between container and host environments
- **Transport Flexibility**: Both process-based (stdio) and web-based (SSE) communication

### Production Robustness
- **Process Management**: Sophisticated proxy process lifecycle with orphan detection
- **Error Recovery**: Comprehensive error handling with retry logic and graceful degradation
- **Resource Management**: Automatic cleanup with configurable timeouts and instance limits
- **Protocol Integrity**: Console output silencing to prevent MCP protocol corruption

### Development and Testing Support
- **Complete Mock Infrastructure**: Full mock implementations for all major components
- **Dependency Injection**: Interface-based design enabling easy test isolation
- **Comprehensive Logging**: Structured logging with sanitization for security
- **Type Safety**: Full TypeScript coverage with runtime type validation

## Internal Organization and Data Flow

### Startup Sequence
1. **Bootstrap**: `index.ts` silences console output and parses CLI arguments
2. **Dependency Wiring**: `container/` creates complete production dependency graph
3. **Server Initialization**: `server.ts` registers debugging tools with MCP SDK
4. **Transport Setup**: CLI handlers establish stdio or SSE communication channels

### Debugging Session Flow
1. **Session Creation**: `session/SessionManager` creates language-specific debug session
2. **Adapter Discovery**: `adapters/` locates and instantiates appropriate language adapter
3. **Proxy Management**: `proxy/ProxyManager` spawns debug adapter proxy process
4. **Protocol Bridging**: `proxy/` translates between MCP tools and DAP commands
5. **State Management**: `session/` maintains debugging state and coordinates operations

### Cross-Cutting Concerns
- **Path Resolution**: `utils/container-path-utils` handles container/host path mapping
- **Error Handling**: `errors/` provides typed error hierarchy with recovery semantics
- **Logging**: `utils/logger` provides structured logging with transport protection
- **Type Safety**: `utils/type-guards` validates data at critical boundaries

This architecture enables the Debug MCP Server to provide a clean, AI-agent-friendly debugging interface while managing the complexity of multi-language debugging, cross-environment deployment, and production reliability requirements.