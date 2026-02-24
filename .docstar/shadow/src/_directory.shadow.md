# src/
@children-hash: c53a68566f5c5882
@generated: 2026-02-24T18:27:47Z

## Overall Purpose and Responsibility

The `src` directory serves as the main implementation of a comprehensive debug MCP (Model Context Protocol) server system that enables language-agnostic debugging capabilities for AI agents. This system provides step-through debugging, variable inspection, breakpoint management, and expression evaluation across multiple programming languages through a standardized MCP interface.

## Key Components and Architecture

### Core Entry Points
The system is bootstrapped through `index.ts` which provides the primary factory function `createDebugMcpServer()` and handles console output silencing to protect MCP protocol integrity. The main `DebugMcpServer` class in `server.ts` implements the MCP protocol, registering 18 debug tools and managing the complete debug session lifecycle.

### Multi-Layer Architecture
The system follows a sophisticated layered architecture:

1. **Protocol Layer** (`server.ts`, `cli/`): MCP protocol implementation with stdio/SSE transport modes
2. **Session Management** (`session/`): Complete debug session orchestration with dual state models  
3. **Proxy System** (`proxy/`): Multi-process DAP proxy for language-agnostic debugging
4. **Adapter System** (`adapters/`): Pluggable debug adapter discovery, loading, and lifecycle management
5. **Core Implementation** (`implementations/`): Production Node.js implementations of all abstractions
6. **Dependency Injection** (`container/`): Comprehensive DI framework for system composition

### Debug Adapter Protocol Integration
The system implements a sophisticated DAP proxy architecture through the `proxy/` and `dap-core/` modules. The proxy system spawns isolated worker processes for each debug session, with policy-driven adapter selection supporting Python, JavaScript, Rust, Go, and mock debugging scenarios. The `dap-core` provides functional, stateless DAP message processing with pure state transformations.

### Language Support Infrastructure
Dynamic language adapter support is enabled through the `adapters/` directory, which provides progressive resolution strategies for discovering and loading language-specific debug adapters. The system supports both compile-time registration and runtime discovery with comprehensive caching and error recovery.

## Public API Surface

### Main Entry Points
- `createDebugMcpServer(options: ServerOptions)`: Primary factory for server instantiation
- `main()`: CLI execution entry point with stdio/SSE command support
- MCP Tools (18 total): Complete debug API including session management, stepping, breakpoints, variable inspection, and expression evaluation

### Key Capabilities
- **Session Management**: create_debug_session, list_debug_sessions, close_debug_session
- **Debug Control**: start_debugging, attach_to_process, detach_from_process
- **Execution Control**: step_over, step_into, step_out, continue_execution, pause_execution
- **Data Inspection**: get_variables, get_local_variables, get_stack_trace, get_scopes
- **Advanced Features**: evaluate_expression, get_source_context, set_breakpoint
- **Language Discovery**: list_supported_languages

### Transport Modes
- **Stdio Mode**: Standard MCP transport for direct integration
- **SSE Mode**: HTTP-based Server-Sent Events for web integration
- **Container Support**: Full Docker/container deployment compatibility

## Internal Organization and Data Flow

### Request Processing Flow
1. MCP requests arrive through transport layer (stdio/SSE)
2. `DebugMcpServer` validates requests and routes to appropriate handlers
3. `SessionManager` orchestrates debug operations with dependency injection
4. `ProxyManager` spawns worker processes for language-specific debugging
5. DAP communication flows through policy-driven adapter system
6. Results flow back through session management to MCP protocol layer

### Cross-Cutting Concerns
- **Error Handling** (`errors/`): Comprehensive typed error hierarchy with semantic categorization
- **Utilities** (`utils/`): Cross-environment compatibility, security sanitization, logging
- **Factory System** (`factories/`): Centralized object creation with dependency injection
- **Interface Abstractions** (`interfaces/`): Clean abstraction layer enabling testability

### State Management Strategy
The system employs sophisticated state management with:
- Immutable DAP session state in `dap-core/`
- Dual state models in session management for migration support
- Policy-driven adapter behaviors for language-specific customization
- Event-driven coordination between proxy workers and session managers

## Important Patterns and Conventions

### Architectural Patterns
- **Dependency Injection**: Comprehensive DI system enabling testing and modularity
- **Factory Pattern**: Centralized object creation with proper lifecycle management
- **Proxy Pattern**: Multi-process debugging through worker process isolation
- **Policy Pattern**: Language-specific behaviors through pluggable policies
- **Observer Pattern**: Event-driven communication and state management

### Container-Aware Design
The entire system is designed for containerized deployment with path resolution utilities, environment detection, signal handling, and workspace root resolution for Docker volume mounts.

### Security and Reliability
- Console output silencing to protect MCP protocol integrity
- Comprehensive sanitization of sensitive data in logs
- Timeout handling for all operations with graceful degradation
- Process cleanup with signal escalation and orphan detection
- Type safety through comprehensive interfaces and validation

This directory represents a production-ready, enterprise-grade debug server system that bridges AI agents with traditional debugging workflows across multiple programming languages while maintaining protocol integrity and operational reliability.