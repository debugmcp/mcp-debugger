# src/
@generated: 2026-02-12T21:06:27Z

## Overall Purpose

The `src` directory implements the complete Debug MCP Server - a Model Context Protocol (MCP) server that exposes debugging capabilities for multiple programming languages through a unified interface. It bridges AI agents with debug adapters, enabling programmatic debugging operations through MCP tools while supporting both stdio and HTTP/SSE transports.

## Primary Architecture

The system follows a layered architecture with clear separation of concerns:

**Protocol Layer**: `index.ts` serves as the main entry point with console output silencing and CLI routing. `server.ts` implements the core MCP server that exposes 16 debugging tools (session management, execution control, inspection, evaluation) to AI agents.

**Abstraction Layers**: 
- `interfaces/` defines all contracts for dependency injection and testability
- `implementations/` provides production Node.js-based implementations  
- `errors/` establishes typed error hierarchy for robust error handling

**Core Services**:
- `session/` manages complete debug session lifecycle with hierarchical inheritance pattern
- `proxy/` implements DAP proxy system with process isolation and multi-session support
- `adapters/` provides dynamic language adapter discovery and registration
- `container/` serves as dependency injection foundation wiring all components

**Infrastructure**:
- `cli/` implements complete CLI framework with stdio/SSE transport modes
- `dap-core/` provides functional DAP message processing with immutable state
- `utils/` offers cross-environment utilities for paths, logging, and type safety
- `factories/` enables testable object creation patterns

## Key Integration Flow

1. **Startup**: `index.ts` silences console output, initializes dependencies via `container/`, and sets up CLI commands
2. **MCP Server**: `server.ts` registers tools that delegate to `SessionManager` for debug operations
3. **Session Management**: `session/` creates debug sessions, spawns proxy processes, and manages DAP communication
4. **Proxy System**: `proxy/` isolates debug adapters in worker processes with DAP message routing
5. **Language Support**: `adapters/` dynamically discovers and loads language-specific debug adapters
6. **Transport**: `cli/` handles MCP protocol over stdio or HTTP/SSE for different client scenarios

## Public API Surface

**Main Entry Points**:
- `createDebugMcpServer(options)` - Factory for server instances with logging configuration
- CLI commands: `stdio`, `sse`, `check-rust-binary` for different deployment modes
- 16 MCP tools: session management, debugging control, execution control, inspection, evaluation

**Key MCP Tools**:
- Session: `create_debug_session`, `list_debug_sessions`, `close_debug_session`
- Control: `start_debugging`, `attach_to_process`, `step_over`, `step_into`, `continue_execution`
- Inspection: `get_variables`, `get_stack_trace`, `evaluate_expression`, `get_source_context`
- Discovery: `list_supported_languages`

**Configuration Interfaces**:
- `ServerOptions` - Server configuration (logLevel, logFile)
- `ContainerConfig` - Dependency injection configuration
- Transport-specific options for stdio/SSE modes

## Critical Design Patterns

**Dependency Injection**: Complete constructor injection throughout with `container/` providing production dependencies and `factories/` enabling test doubles.

**Process Isolation**: Debug adapters run in separate proxy processes via `proxy/` to prevent crashes from affecting the main MCP server.

**Dynamic Language Support**: `adapters/` registry enables runtime discovery and loading of language adapters using consistent naming conventions.

**Functional Architecture**: `dap-core/` provides stateless DAP message processing with immutable state management and command-based side effects.

**Cross-Environment Compatibility**: `utils/` provides container-aware path resolution and environment detection for consistent behavior across host and container deployments.

**Type Safety**: Comprehensive TypeScript interfaces with discriminated unions, runtime validation at boundaries, and structured error handling via `errors/`.

**Event-Driven Communication**: Session management uses event emitters for DAP communication with automatic cleanup and resource management.

The `src` directory represents a complete, production-ready MCP server implementation that abstracts complex debugging toolchains behind a clean, consistent API while supporting multiple transport protocols and deployment environments.