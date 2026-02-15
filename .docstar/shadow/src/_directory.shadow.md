# src/
@children-hash: b3e3afcbd6bb8c44
@generated: 2026-02-15T09:02:11Z

## Overall Purpose

The `src` directory contains the complete implementation of Debug MCP Server - a sophisticated debugging bridge that exposes Debug Adapter Protocol (DAP) functionality through the Model Context Protocol (MCP). This system enables AI agents to perform interactive debugging operations across multiple programming languages (Python, JavaScript, Rust, Go) through a standardized MCP tool interface.

## Core Architecture

The system follows a layered architecture with clear separation of concerns:

### Transport & Protocol Layer
- **Entry Point** (`index.ts`): Main server initialization with console silencing for MCP protocol integrity
- **CLI Framework** (`cli/`): Multiple transport modes (stdio, SSE) with standardized command handling
- **MCP Server** (`server.ts`): Core MCP server that exposes 16 debug tools through Model Context Protocol

### Debug Proxy & Session Management
- **Proxy System** (`proxy/`): Sophisticated DAP proxy middleware supporting multi-session debugging, policy-driven adapter behavior, and robust process lifecycle management
- **Session Management** (`session/`): Complete debug session lifecycle with state management, event handling, and debug operations (stepping, breakpoints, evaluation)
- **DAP Core** (`dap-core/`): Functional, stateless DAP message processing engine with pure state transformations

### Language Support & Adaptation
- **Adapter System** (`adapters/`): Dynamic discovery and lifecycle management of language-specific debug adapters with pluggable architecture
- **Container Support**: Built-in containerized deployment support with path resolution and environment detection

### Infrastructure & Dependencies
- **Dependency Injection** (`container/`): Complete DI system for bootstrapping all application dependencies
- **Error System** (`errors/`): Comprehensive typed error hierarchy extending MCP SDK base errors
- **Utilities** (`utils/`): Cross-environment compatibility, file operations, logging, and validation utilities
- **Implementations** (`implementations/`): Production-ready concrete implementations of all system abstractions

## Key Components Integration

The components work together in a sophisticated pipeline:

1. **Initialization Flow**: Entry point silences console → CLI setup → dependency container bootstrap → MCP server creation with tool registration
2. **Debug Session Flow**: MCP tools → Session Manager → Proxy Manager → DAP Proxy Worker → Language Adapter → Debug Target
3. **Message Flow**: DAP events ← Proxy System ← Session Management ← MCP Protocol ← AI Agent
4. **State Management**: Functional DAP core processes messages → Session state updates → Proxy coordination → Multi-session support

## Public API Surface

### Primary Entry Points
- **`createDebugMcpServer(options)`**: Main factory function for MCP server instances
- **MCP Tools**: 16 standardized tools for debug operations:
  - Session management: `create_debug_session`, `list_debug_sessions`, `close_debug_session`
  - Debug control: `start_debugging`, `step_over`, `step_into`, `step_out`, `continue_execution`
  - Inspection: `get_variables`, `get_stack_trace`, `evaluate_expression`, `get_source_context`
  - Discovery: `list_supported_languages`

### CLI Interface
- **Transport Commands**: `stdio` (default), `sse` for HTTP-based debugging
- **Utility Commands**: `check-rust-binary` for Rust debugging diagnostics
- **Configuration Options**: Logging levels, output files, port configuration

### Language Support
- **Dynamic Discovery**: Runtime detection of available debug adapters
- **Supported Languages**: Python, JavaScript/Node.js, Rust, Go with extensible adapter system
- **Container Deployment**: Specialized handling for containerized debugging environments

## Key Patterns & Design Principles

### Functional Core, Imperative Shell
- Pure functional DAP message processing with side effects as commands
- Immutable state management with explicit state transitions
- Effect-as-data pattern for testability and reliability

### Dependency Injection Throughout
- Interface-based abstractions for all external dependencies
- Factory pattern for complex object creation
- Comprehensive mock implementations for testing

### Multi-Transport Protocol Support
- MCP over stdio (primary) and Server-Sent Events
- Console output silencing to prevent protocol corruption
- Graceful degradation and error handling

### Cross-Environment Compatibility
- Host and container deployment modes with path resolution
- Environment-driven configuration and feature toggling
- Robust process lifecycle management with timeout handling

## Integration Context

This directory serves as the complete MCP debugging server implementation, designed to:
- Bridge AI agents with traditional debugging tools through MCP protocol
- Support multiple programming languages through pluggable adapter architecture  
- Handle complex debugging scenarios including multi-session debugging and containerized deployment
- Provide production-ready reliability with comprehensive error handling and logging
- Enable easy testing and extension through dependency injection and functional design patterns

The system transforms traditional IDE debugging capabilities into MCP tools that AI agents can use for interactive code analysis and debugging workflows.