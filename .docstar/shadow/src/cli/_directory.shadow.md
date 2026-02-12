# src/cli/
@generated: 2026-02-11T23:47:54Z

## Purpose
The `src/cli` directory implements a comprehensive CLI interface for a Debug MCP (Model Context Protocol) server system. It provides multiple transport mechanisms (stdio, SSE) for MCP communication and binary analysis tools for debugging workflows, with robust error handling and process management designed for both interactive and containerized environments.

## Key Components & Integration

### Core CLI Framework
- **setup.ts**: Centralizes CLI command configuration using Commander.js, establishing consistent patterns for logging, transport selection, and command handlers across all operations
- **version.ts**: Provides cross-environment version resolution from package.json, supporting both CommonJS and ESM module systems
- **error-handlers.ts**: Implements global Node.js error handling with structured logging and fail-fast behavior for unhandled exceptions

### Transport Command Handlers
- **stdio-command.ts**: Default MCP transport using stdin/stdout, optimized for containerized environments with keep-alive mechanisms and graceful shutdown handling
- **sse-command.ts**: HTTP-based MCP transport using Server-Sent Events, supporting multiple concurrent connections through a shared server instance with session management

### Binary Analysis Commands
- **commands/**: Extensible command directory providing binary analysis capabilities, currently supporting Rust executable analysis with debugging compatibility assessment and toolchain recommendations

## Public API Surface

### Main Entry Points
- `createCLI()`: Factory for Commander.js program instances with standard metadata
- `setupStdioCommand(handler)`: Configures default stdio transport command
- `setupSSECommand(handler)`: Configures HTTP/SSE transport command  
- `setupCheckRustBinaryCommand(handler)`: Configures Rust binary analysis command
- `setupErrorHandlers(dependencies)`: Global error handler configuration

### Command Handlers
- `handleStdioCommand(options)`: Stdio MCP server execution with container-aware lifecycle management
- `handleSSECommand(options)`: HTTP/SSE server execution with multi-session support
- `handleCheckRustBinaryCommand(binaryPath, options)`: Rust binary debugging analysis

## Internal Organization & Data Flow

### Architecture Patterns
- **Dependency Injection**: All handlers accept dependencies through interfaces, enabling testability and modularity
- **Transport Abstraction**: MCP server logic is decoupled from transport mechanisms (stdio vs SSE)
- **Shared Server Model**: SSE mode uses a single DebugMcpServer instance serving multiple concurrent connections
- **Environment-Aware Design**: Console output silencing and container-specific handling throughout

### Command Flow
1. CLI setup creates Commander program with standardized options (logging, transport selection)
2. Global error handlers are registered for unhandled exceptions
3. Selected command handler initializes appropriate transport and server instance
4. MCP communication established through chosen transport layer
5. Graceful shutdown coordinates transport cleanup and process termination

### Critical Integration Points
- **Logger Integration**: Winston-based structured logging with configurable levels and output destinations
- **MCP Server Coupling**: All transport handlers depend on shared DebugMcpServer from `../server.js`
- **Adapter System**: Binary analysis commands use lazy-loaded adapters (`@debugmcp/adapter-rust`) for extensibility

## Key Responsibilities
- **Multi-Transport MCP Interface**: Provides stdio and HTTP/SSE transport options for different deployment scenarios
- **Process Lifecycle Management**: Robust startup, keep-alive, and shutdown handling for containerized environments  
- **Developer Tooling**: Binary analysis capabilities with actionable debugging recommendations
- **Error Resilience**: Comprehensive error handling from global process level down to individual command failures
- **Configuration Management**: Standardized logging, version resolution, and option parsing across all operations

The CLI directory serves as the primary user interface to the Debug MCP system, abstracting transport complexity while providing powerful debugging analysis tools through a consistent, well-structured command-line interface.