# src/
@children-hash: fd9105115e066656
@generated: 2026-02-24T01:55:55Z

## Overall Purpose and Responsibility

The `src` directory is the main source code for Debug MCP Server - a production-ready Model Context Protocol (MCP) server that provides multi-language debugging capabilities through standardized tooling interfaces. This module implements a complete debugging framework that bridges MCP clients with language-specific debug adapters, enabling step-through debugging, breakpoint management, variable inspection, and expression evaluation across Python, JavaScript, Rust, and other programming languages.

## Architecture and Component Integration

The directory follows a layered architecture with clear separation of concerns:

### Core Application Layer
- **`index.ts`** serves as the primary entry point, handling initialization, CLI routing, and console output silencing for protocol safety
- **`server.ts`** implements the main `DebugMcpServer` class with 18 registered MCP tools for debugging operations
- **`container/`** provides dependency injection infrastructure that wires together all system components

### Transport and Interface Layer  
- **`cli/`** implements multiple transport modes (stdio, SSE) with comprehensive error handling and debugging utilities
- **`errors/`** defines a typed error hierarchy extending MCP SDK errors for structured error handling
- **`interfaces/`** establishes TypeScript contracts for all system abstractions and dependency injection

### Debug Infrastructure Layer
- **`session/`** manages complete debug session lifecycle through a layered class hierarchy (SessionManager → Operations → Data → Core)
- **`proxy/`** implements a DAP (Debug Adapter Protocol) proxy system using worker processes for multi-language debugging
- **`dap-core/`** provides pure functional DAP message processing with immutable state management
- **`adapters/`** enables dynamic discovery and loading of language-specific debug adapters

### Implementation and Utilities Layer
- **`implementations/`** contains production-ready concrete implementations of all core abstractions using Node.js APIs
- **`factories/`** provides Factory pattern implementations for dependency injection and testing infrastructure
- **`utils/`** offers foundational utilities for cross-environment compatibility, security, logging, and data validation

## Public API Surface and Entry Points

### Primary Entry Points
- **`createDebugMcpServer(options?: ServerOptions)`** - Main factory function for server instances
- **CLI Commands**:
  - `stdio` - MCP protocol over stdio transport (default)
  - `sse` - MCP protocol over Server-Sent Events HTTP transport
  - `check-rust-binary` - Rust binary analysis utility

### MCP Tools (18 total)
The server registers comprehensive debugging tools organized by function:
- **Session Management**: `create_debug_session`, `list_debug_sessions`, `close_debug_session`
- **Process Control**: `start_debugging`, `attach_to_process`, `detach_from_process`
- **Execution Control**: `step_over`, `step_into`, `step_out`, `continue_execution`, `pause_execution`
- **Data Inspection**: `get_variables`, `get_local_variables`, `get_stack_trace`, `get_scopes`
- **Advanced Operations**: `evaluate_expression`, `get_source_context`, `set_breakpoint`
- **Discovery**: `list_supported_languages`

### Configuration Interfaces
- **`ServerOptions`** - Server configuration with logging options
- **`ContainerConfig`** - Dependency injection container configuration
- **Language-specific configurations** - Python, JavaScript, Rust, and Mock language support

## Key Data Flow and Integration Patterns

### Debug Session Lifecycle
1. **Initialization**: Client creates debug session via MCP tool → SessionManager creates session → AdapterRegistry provides language adapter
2. **Startup**: ProxyManager spawns worker process → DAP connection established → Debug target launched
3. **Runtime**: Debug commands flow through MCP → SessionManager → ProxyManager → DAP Protocol → Language adapter
4. **Data Retrieval**: Variable/stack inspection requests processed through functional DAP core → Results returned via MCP
5. **Cleanup**: Session termination triggers cascading cleanup across all layers

### Transport Safety and Protocol Integrity
- **Console Output Silencing**: Critical initialization prevents stdout pollution that corrupts MCP protocol
- **Multiple Transport Support**: Unified server implementation works across stdio and HTTP/SSE transports
- **Container Awareness**: Special handling for Docker environments with file-based diagnostics

### Multi-Language Extensibility
- **Adapter Plugin System**: Dynamic discovery and loading of language-specific adapters (`@debugmcp/adapter-{language}`)
- **Policy-Driven Configuration**: Language-specific behaviors encapsulated in adapter policies
- **Unified Interface**: Consistent debugging API regardless of target language

## Critical Design Patterns

### Dependency Injection Architecture
All major components use constructor injection with comprehensive DI container, enabling testing and modularity while supporting both production and mock implementations.

### Event-Driven Communication
DAP proxy system uses IPC-based worker processes with heartbeat monitoring, enabling isolation and fault tolerance across debug sessions.

### Functional Core, Imperative Shell
DAP message processing uses pure functional transformations with immutable state, while I/O operations are handled by imperative wrappers.

### Environment Adaptation
All components handle containerized vs native deployment through centralized environment detection and path resolution utilities.

This directory represents a complete, production-ready debugging framework that successfully bridges the MCP protocol with traditional debugging tools while maintaining clean architecture, comprehensive error handling, and multi-environment compatibility.