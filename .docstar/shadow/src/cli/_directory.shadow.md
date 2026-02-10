# src/cli/
@generated: 2026-02-09T18:16:32Z

## Purpose and Responsibility

The `src/cli` directory provides a comprehensive command-line interface framework for Debug MCP (Model Context Protocol) applications. It establishes standardized CLI patterns for different transport modes (stdio and Server-Sent Events), implements global error handling, and provides debugging tools for binary analysis.

## Key Components and Architecture

### Core CLI Framework
- **setup.ts**: Central CLI configuration factory using Commander.js, defining consistent patterns for command setup across transport modes
- **version.ts**: Cross-platform version resolution utility that works in both CommonJS and ESM environments
- **error-handlers.ts**: Global error handling system that captures uncaught exceptions and unhandled promise rejections

### Transport Command Handlers
- **stdio-command.ts**: Handles MCP server startup in stdio mode with robust lifecycle management for containerized environments
- **sse-command.ts**: Creates Express.js application for Server-Sent Events transport using a shared server model where all SSE connections use the same MCP server instance

### Command Utilities
- **commands/**: Contains specialized CLI command handlers for debugging tools, particularly binary analysis commands with dual output formatting (JSON and human-readable)

## Public API Surface

### Main Entry Points
- `createCLI()`: Factory function for creating base Commander programs
- `setupStdioCommand()`: Configures default stdio transport command
- `setupSSECommand()`: Configures SSE transport command with port specification
- `setupCheckRustBinaryCommand()`: Configures binary analysis command
- `handleStdioCommand()`: Stdio server handler with lifecycle management
- `handleSSECommand()`: SSE server handler with session management
- `setupErrorHandlers()`: Global error handling setup

### Configuration Interfaces
- `StdioOptions`, `SSEOptions`, `CheckRustBinaryOptions`: Type-safe command configuration
- Transport-specific handler types with consistent async signatures

## Internal Organization and Data Flow

### Command Setup Flow
1. **CLI Creation**: `createCLI()` establishes base Commander program
2. **Command Registration**: Setup functions configure specific transport commands with options
3. **Handler Binding**: Command handlers are bound to process user requests
4. **Error Handling**: Global error handlers provide safety nets

### Transport Architecture
- **Shared Server Model**: SSE mode uses single MCP server instance across all connections for state consistency
- **Session Management**: Each transport maintains separate sessions with cleanup guards
- **Environment Awareness**: Commands set `CONSOLE_OUTPUT_SILENCED=1` to prevent transport protocol interference

### Dependency Injection Pattern
All command handlers use dependency injection for:
- Winston logger instances
- Server factory functions
- Optional process exit function overrides (for testing)

## Important Patterns and Conventions

### Transport Protection
Both stdio and SSE commands automatically silence console output to prevent corruption of MCP transport protocols.

### Graceful Lifecycle Management
- Keep-alive mechanisms for containerized deployments
- Proper cleanup of transport sessions and server instances
- Signal handling for graceful shutdown (SIGTERM/SIGINT)

### Error Handling Strategy
- Fail-fast approach with structured logging
- Global exception capture with process termination
- Contextual error enhancement with actionable user guidance

### Cross-Platform Compatibility
- Module directory resolution works in both CommonJS and ESM
- Container-aware stdin handling for detached environments
- Dynamic import patterns for optional dependencies

## Key Dependencies

- **Commander.js**: CLI framework and command parsing
- **Express.js**: HTTP server for SSE transport mode
- **MCP SDK**: Server-Sent Events and stdio transport implementations
- **Winston**: Structured logging across all components

The CLI module serves as the primary interface layer for Debug MCP applications, providing consistent, robust command-line experiences across different deployment scenarios while maintaining clean separation between transport protocols and core MCP functionality.