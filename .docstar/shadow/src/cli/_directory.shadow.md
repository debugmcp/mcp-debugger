# src\cli/
@generated: 2026-02-12T21:01:13Z

## Purpose
The `src/cli` directory implements the command-line interface layer for a debugging MCP (Model Context Protocol) server system. This module provides standardized CLI commands for multi-transport server operations (stdio, SSE) and specialized debugging tools for binary analysis, with robust error handling and graceful shutdown capabilities.

## Core Architecture

### Multi-Transport Server System
The CLI supports multiple communication protocols for MCP server operations:
- **Stdio Transport**: Direct stdin/stdout communication for containerized environments
- **SSE Transport**: HTTP-based Server-Sent Events with bidirectional messaging via POST
- **Binary Analysis**: Specialized commands for executable inspection and debugging

### Centralized Setup and Configuration
- **setup.ts**: Factory functions for Commander.js CLI structure with standardized option patterns
- **version.ts**: Cross-environment version resolution from package.json
- **error-handlers.ts**: Global Node.js error handling with structured logging and fail-fast behavior

## Key Components and Integration

### Command Handlers
- **stdio-command.ts**: Manages stdio transport with keep-alive mechanisms for containerized environments
- **sse-command.ts**: Implements Express-based SSE server with shared DebugMcpServer instance and session management
- **commands/**: Binary analysis commands with lazy loading and flexible output formatting

### Supporting Infrastructure
- **Dependency Injection**: All handlers accept dependencies for testability (logger, server factory, exit handlers)
- **Environment Adaptation**: Console output silencing for transport protection, cross-module compatibility
- **Graceful Shutdown**: Coordinated cleanup across transports and server instances

## Public API Surface

### Main Entry Points
- `createCLI()`: Factory for Commander.js program instances
- `setupStdioCommand()`: Default stdio transport configuration
- `setupSSECommand()`: HTTP-based transport with port configuration
- `setupCheckRustBinaryCommand()`: Binary analysis command setup
- `handleStdioCommand()`: Stdio mode execution
- `handleSSECommand()`: SSE mode execution
- `handleCheckRustBinaryCommand()`: Rust binary analysis execution

### Configuration Types
- `StdioOptions`: Logging controls for stdio transport
- `SSEOptions`: Port and logging configuration for HTTP transport
- `CheckRustBinaryOptions`: Binary analysis output formatting options

## Internal Organization and Data Flow

### Server Lifecycle Management
1. **Setup Phase**: CLI argument parsing, dependency injection, logger configuration
2. **Transport Initialization**: Protocol-specific transport creation (stdio/SSE/analysis)
3. **Server Connection**: MCP server instantiation and transport binding
4. **Keep-alive/Session Management**: Connection maintenance and multi-client handling
5. **Graceful Shutdown**: Signal handling, transport cleanup, process termination

### Error Handling Strategy
- **Global Handlers**: Process-level uncaught exception and unhandled rejection management
- **Transport Protection**: Console output silencing to prevent protocol corruption
- **Dependency Resilience**: Lazy loading with helpful error messages for missing components
- **Structured Logging**: Winston-based logging with environment-aware output control

## Important Patterns and Conventions

### Transport Isolation
- Environment variable `CONSOLE_OUTPUT_SILENCED` coordinates logging behavior
- Separate command handlers prevent cross-protocol interference
- Shared server instances for multi-client scenarios (SSE)

### Containerized Environment Support
- Keep-alive intervals prevent premature container shutdown
- Signal-based lifecycle management (SIGTERM/SIGINT)
- Stdin end handling for detached container scenarios

### Modular Command Architecture
- Factory pattern for server creation enabling different configurations
- Handler injection pattern for testability and flexibility
- Consistent option patterns across commands (`--log-level`, `--log-file`)

### Development Experience
- Build instruction guidance for missing dependencies
- Multiple output formats (JSON/human-readable) for different use cases
- Runtime environment detection and graceful degradation

This directory serves as the complete CLI interface for the debugging MCP system, providing both server transport capabilities and specialized debugging tools through a unified, robust command-line interface.