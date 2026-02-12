# src/
@generated: 2026-02-12T21:01:44Z

## Overall Purpose

The `src` directory contains the complete implementation of Debug MCP Server - a Model Context Protocol (MCP) server that provides debugging capabilities for multiple programming languages through standardized tooling. This module bridges AI agents and debug adapters, enabling programmatic debugging through MCP tools while supporting both containerized and standalone deployment modes.

## Architecture & Component Integration

The system follows a layered architecture with clear separation of concerns:

### Core Server Layer (`index.ts`, `server.ts`)
- **Entry Point**: `index.ts` handles initialization, console silencing for MCP protocol integrity, and CLI routing
- **MCP Server**: `server.ts` exposes 16 MCP tools for debugging operations, wrapping session management and providing language discovery
- **Dynamic Language Support**: Runtime detection of available debug adapters with containerized environment awareness

### Debug Infrastructure
- **Session Management** (`session/`): Complete debug session lifecycle management with multi-language support through adapter policies
- **DAP Proxy System** (`proxy/`): Sophisticated Debug Adapter Protocol proxy enabling multi-session debugging and language-agnostic adapter orchestration
- **Debug Adapters** (`adapters/`): Dynamic adapter loading, registration, and lifecycle management for different programming languages

### Service Layer
- **Dependency Container** (`container/`): Production IoC container orchestrating complete application dependency graph
- **Implementations** (`implementations/`): Production-ready concrete implementations for file system, process management, and networking
- **Factories** (`factories/`): Centralized object creation with dependency injection and testing support

### Supporting Infrastructure
- **CLI Commands** (`cli/`): Multi-transport command interface supporting stdio/SSE communication and binary analysis
- **Core Protocol** (`dap-core/`): Pure functional DAP message handling and state management
- **Error System** (`errors/`): Comprehensive typed error hierarchy with recovery strategies
- **Utilities** (`utils/`): Cross-environment compatibility, logging, file operations, and type safety

## Public API Surface

### Primary Entry Points
- **`createDebugMcpServer(options)`**: Main server factory function accepting logging configuration
- **CLI Commands**: `stdio`, `sse`, and `check-rust-binary` modes for different deployment scenarios
- **MCP Tools**: 16 standardized debugging tools accessible through MCP protocol

### Key MCP Tools
- **Session Management**: `create_debug_session`, `list_debug_sessions`, `close_debug_session`
- **Debug Control**: `start_debugging`, `attach_to_process`, step operations, breakpoint management
- **Runtime Inspection**: `get_variables`, `get_stack_trace`, `evaluate_expression`
- **Language Discovery**: `list_supported_languages` with dynamic adapter detection

### Configuration Interfaces
- **ServerOptions**: Server-level configuration (logging, file output)
- **Session Configuration**: Debug session parameters and adapter settings
- **Transport Options**: Stdio/SSE communication configuration

## Internal Data Flow & Integration

### Debugging Session Flow
1. **Language Discovery**: Dynamic adapter registry queries available debug adapters
2. **Session Creation**: SessionManager creates new debug sessions with language validation
3. **Proxy Orchestration**: ProxyManager spawns language-specific debug adapter processes
4. **DAP Communication**: Multi-layered proxy system handles Debug Adapter Protocol messaging
5. **State Management**: Pure functional state transitions with event-driven coordination
6. **Tool Execution**: MCP tools route through SessionManager to underlying debug operations

### Cross-Environment Support
- **Path Resolution**: Centralized utilities handle host vs container path mapping
- **Process Management**: Container-aware process spawning and lifecycle management
- **Logging Strategy**: Environment-specific logging with console silencing for protocol integrity
- **Resource Management**: Automatic cleanup and graceful shutdown across deployment modes

## Key Patterns & Design Principles

### Protocol Integrity
- Console output permanently silenced to prevent MCP protocol corruption
- Structured error responses in JSON format for tool operations
- Transport isolation preventing cross-protocol interference

### Multi-Language Architecture
- Plugin-style adapter system with dynamic loading capabilities
- Policy-driven language-specific behavior without hardcoded logic
- Unified debugging interface abstracting language differences

### Production Readiness
- Comprehensive dependency injection enabling testability and modularity
- Robust error handling with typed error hierarchy and recovery strategies
- Resource lifecycle management with automatic cleanup and orphan detection
- Container-first design with native Docker/containerized deployment support

### Functional Core, Imperative Shell
- Pure functional DAP message processing with immutable state management
- Side effects represented as data structures for external execution
- Clear separation between business logic and I/O operations

This directory represents a complete MCP debugging server implementation that transforms complex debug adapter orchestration into simple, standardized MCP tools accessible to AI agents while maintaining production-grade reliability and multi-environment compatibility.