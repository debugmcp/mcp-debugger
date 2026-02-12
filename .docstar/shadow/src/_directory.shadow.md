# src/
@generated: 2026-02-11T23:48:29Z

## Overall Purpose

The `src` directory implements a comprehensive Debug MCP (Model Context Protocol) Server - a production-ready debugging system that enables AI agents to debug applications in multiple programming languages through the Model Context Protocol. The system provides a complete debugging infrastructure that bridges MCP tools with debug adapters, enabling step-through debugging, breakpoint management, variable inspection, and expression evaluation across different programming languages.

## Core Architecture and Component Integration

The system follows a layered architecture with clear separation of concerns:

### Presentation Layer
- **index.ts**: Main entry point providing console silencing, CLI routing, and server factory functions
- **cli/**: Complete CLI interface with stdio and SSE transport options, binary analysis tools, and robust error handling
- **server.ts**: Primary MCP server exposing 16 debug tools (session management, debugging control, execution control, inspection, evaluation, discovery)

### Application Layer  
- **session/**: Complete session management system providing centralized debug adapter lifecycle control, state management, and debugging operations through a layered architecture
- **proxy/**: Sophisticated DAP proxy system acting as intermediary between MCP servers and debug adapters, enabling language-agnostic debugging with multi-session support

### Domain Layer
- **dap-core/**: Functional DAP message processing engine with immutable state management and pure functional message handling
- **adapters/**: Dynamic adapter management infrastructure for discovering, loading, and managing language-specific debug adapters
- **errors/**: Comprehensive typed error hierarchy providing semantic error classes for type-safe error handling

### Infrastructure Layer
- **implementations/**: Production implementations of all core abstractions, bridging domain interfaces with Node.js runtime capabilities
- **interfaces/**: TypeScript contracts enabling dependency injection, testability, and loose coupling
- **container/**: Dependency injection system providing centralized service configuration and wiring
- **factories/**: Centralized factory pattern implementation for creating key system components with DI support
- **utils/**: Foundational utilities for path resolution, file operations, logging, and cross-cutting concerns

## Key Integration Patterns

### MCP Protocol Integration
The system exposes debugging capabilities as MCP tools, with the server translating MCP tool calls into debug adapter operations. Each debug operation (breakpoints, stepping, variable inspection) is exposed as a distinct MCP tool with proper schemas and validation.

### Debug Adapter Protocol (DAP) Management
The proxy system provides a sophisticated abstraction over DAP, handling message routing, session management, and language-specific behaviors through adapter policies. This enables the system to work with any DAP-compliant debug adapter.

### Dynamic Language Support
The adapter registry system enables runtime discovery and loading of language-specific debug adapters, allowing the system to support new languages without core modifications. Language support includes Python, JavaScript/Node.js, Rust, Go, and extensible mock adapters.

### Multi-Transport Communication
The system supports both stdio (for containerized environments) and Server-Sent Events (for HTTP-based communication), enabling flexible deployment scenarios with the same core functionality.

## Public API Surface

### Main Entry Points
- `createDebugMcpServer(options)`: Primary factory function for creating MCP server instances
- CLI commands: `stdio`, `sse`, `check-rust-binary` for different operational modes
- MCP Tools: 16 standardized tools for debug operations accessible via MCP protocol

### Key Interfaces
- **ServerOptions**: Configuration interface for server initialization (logging, transport)
- **DebugSessionInfo**: Public session metadata for tool responses
- **DebugResult**: Standardized operation results with success/error states
- **ProxyConfig**: Language-agnostic proxy configuration

### Critical Components
- **DebugMcpServer**: Main server class exposing debug operations as MCP tools
- **SessionManager**: Complete debug session management with lifecycle control
- **ProxyManager**: Debug adapter proxy orchestration and message routing
- **AdapterRegistry**: Dynamic language adapter discovery and management

## Data Flow Architecture

1. **MCP Tool Invocation**: AI agents invoke debug tools through MCP protocol
2. **Session Management**: SessionManager coordinates debug sessions with state tracking
3. **Proxy Communication**: ProxyManager spawns and communicates with debug adapter processes
4. **DAP Translation**: Proxy system translates between MCP semantics and DAP protocol
5. **Language Adaptation**: Adapter policies handle language-specific debugging behaviors
6. **Result Aggregation**: Responses flow back through the stack to MCP tool results

## Deployment Scenarios

The system supports multiple deployment modes:
- **Container Mode**: Optimized for Docker environments with stdio transport and file-based diagnostics
- **HTTP Mode**: Server-Sent Events transport for web-based integrations with multi-session support
- **Development Mode**: Rich CLI tooling for binary analysis and debugging workflow validation

## Key Design Principles

- **Language Agnostic**: Core system is language-independent with pluggable adapter support
- **Protocol Compliant**: Full adherence to both MCP and DAP specifications
- **Production Ready**: Comprehensive error handling, logging, resource management, and graceful shutdown
- **Testable**: Extensive dependency injection, factory patterns, and mock implementations
- **Container Aware**: Special handling for containerized environments with path resolution and process management