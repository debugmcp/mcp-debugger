# src/
@children-hash: 3f60217974dde1b0
@generated: 2026-02-19T23:48:54Z

## Overall Purpose and Responsibility

The `src` directory contains the complete implementation of Debug MCP Server - a Model Context Protocol (MCP) server that bridges AI agents with debug adapters across multiple programming languages. This system enables AI agents to perform step-through debugging operations through standardized MCP tools, supporting languages like Python, JavaScript, Rust, and Go via pluggable debug adapters.

## Key Components and Architecture

### Core Server Layer
- **index.ts**: Entry point providing server factory (`createDebugMcpServer`) with console output silencing for MCP protocol safety
- **server.ts**: Main `DebugMcpServer` class exposing 16 MCP tools for debug operations (session management, execution control, inspection, evaluation)

### Debug Adapter Infrastructure  
- **adapters/**: Dynamic adapter discovery and lifecycle management system supporting both compile-time registration and runtime loading of language-specific debug adapters
- **proxy/**: Comprehensive DAP (Debug Adapter Protocol) proxy system bridging MCP clients and debug adapters, handling complex multi-session scenarios and language-specific behavior through policy-driven architecture

### Session Management
- **session/**: Complete debug session lifecycle management with layered architecture (SessionStore → Core → Data → Operations → Manager) providing session creation, execution control, data inspection, and cleanup
- **dap-core/**: Functional, stateless DAP message processing engine using pure functions and effect-as-data patterns for protocol handling

### System Infrastructure
- **container/**: Dependency injection framework providing type-safe configuration and service wiring
- **implementations/**: Production implementations of all core abstractions, bridging domain interfaces with Node.js platform APIs
- **interfaces/**: TypeScript contracts defining the abstraction layer for dependency injection and system integration
- **factories/**: Factory pattern implementations for centralized object creation with dependency injection support

### Utilities and Support
- **cli/**: Command-line interface with multiple transport modes (stdio, SSE), global error handling, and debugging utilities
- **utils/**: Cross-environment compatibility utilities for path resolution, logging, file operations, and type safety
- **errors/**: Comprehensive typed error system extending MCP SDK with debugger-specific error classes

## Public API Surface

### Primary Entry Points
- **`createDebugMcpServer(options: ServerOptions)`**: Main factory function for server instances
- **MCP Tools API**: 16 standardized tools exposed through MCP protocol:
  - Session management: `create_debug_session`, `list_debug_sessions`, `close_debug_session`
  - Debug control: `start_debugging`, `step_over`, `step_into`, `step_out`, `continue_execution`, `pause_execution`
  - Inspection: `get_variables`, `get_local_variables`, `get_stack_trace`, `get_scopes`, `get_source_context`
  - Evaluation: `evaluate_expression`
  - Discovery: `list_supported_languages`

### CLI Interface
- **stdio mode**: `debugmcp stdio` - Standard MCP transport over stdin/stdout
- **SSE mode**: `debugmcp sse` - HTTP Server-Sent Events transport for web integration
- **Utilities**: `debugmcp check-rust-binary` for debugging Rust binary analysis

### Configuration Options
- **ServerOptions**: `{ logLevel?: string, logFile?: string }`
- **Transport-specific options**: Logging controls, port configuration for SSE mode
- **Environment variables**: Container detection, language adapter control, console output management

## Internal Organization and Data Flow

### Initialization Flow
1. **Bootstrap**: index.ts silences console output and sets up CLI commands
2. **Server Creation**: Factory creates DebugMcpServer with dependency injection
3. **Adapter Discovery**: Registry discovers and loads available debug adapters
4. **MCP Registration**: Server registers all 16 tools with the MCP SDK
5. **Transport Setup**: CLI configures stdio or SSE transport modes

### Debugging Workflow
1. **Session Creation**: Client creates debug session via `create_debug_session` tool
2. **Session Start**: `start_debugging` spawns proxy process and establishes DAP connection
3. **Proxy Management**: ProxyManager handles DAP communication with language-specific adapters
4. **Debug Operations**: MCP tools translate to DAP commands through session manager
5. **State Management**: Functional DAP core processes protocol messages and maintains session state
6. **Data Inspection**: Session data layer provides variable, scope, and stack trace information

### Architecture Patterns

**Layered Architecture**: Clean separation between MCP layer, session management, DAP proxy layer, and platform implementations

**Dependency Injection**: Complete abstraction of external dependencies enabling testability and modularity

**Factory Pattern**: Centralized object creation with configurable dependency injection

**Plugin Architecture**: Dynamic adapter loading supporting both bundled and runtime-discovered debug adapters

**Functional Core/Imperative Shell**: Pure functional DAP processing with imperative process management boundaries

**Event-Driven Design**: Comprehensive event handling for session lifecycle, proxy status, and debug adapter communication

## Critical Integration Points

### Protocol Boundaries
- **MCP Protocol**: JSON-RPC communication with AI agents via stdio or SSE transports
- **Debug Adapter Protocol**: TCP-based communication with language-specific debug adapters
- **IPC Communication**: Parent-child process communication for proxy management

### Cross-Environment Support
- **Container Mode**: Automatic path resolution and workspace handling in Docker environments
- **Host Mode**: Direct filesystem and process access for local development
- **Language Runtimes**: Dynamic discovery and validation of Python, Node.js, Rust, Go executables

This directory represents a complete MCP server implementation enabling AI agents to perform sophisticated debugging operations across multiple programming languages through a unified, protocol-compliant interface.