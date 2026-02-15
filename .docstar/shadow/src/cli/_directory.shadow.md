# src\cli/
@children-hash: 36257bff610c042f
@generated: 2026-02-15T09:01:45Z

## Overall Purpose and Responsibility

The `src/cli` directory provides the command-line interface layer for a Debug MCP (Model Context Protocol) server system. This module implements multiple transport modes (stdio, SSE), global error handling, and debugging utilities for Rust binary analysis, creating a comprehensive CLI framework for MCP server operations.

## Key Components and Architecture

### Command Setup and Configuration (`setup.ts`)
- **Central CLI factory**: `createCLI()` creates standardized Commander.js programs with consistent metadata
- **Transport command configuration**: Unified setup functions for stdio, SSE, and utility commands
- **Option standardization**: Consistent logging options (`-l/--log-level`, `--log-file`) across all transport commands
- **Environment control**: Sets `CONSOLE_OUTPUT_SILENCED` to prevent transport protocol corruption

### Transport Command Handlers
- **`stdio-command.ts`**: Primary stdio transport mode with containerized environment handling, keep-alive mechanisms, and graceful shutdown coordination
- **`sse-command.ts`**: HTTP-based Server-Sent Events transport with Express.js server, session management, and multi-client support through shared DebugMcpServer instances

### Error Management (`error-handlers.ts`)
- **Global process-level error handling**: Centralized configuration for `uncaughtException` and `unhandledRejection` events
- **Structured logging**: Winston-based error output with metadata context
- **Dependency injection pattern**: Testable error handler setup with configurable exit behavior

### Utility Components
- **`version.ts`**: Cross-environment version resolution from package.json with multiple fallback strategies
- **`commands/`**: Specialized CLI utilities for Rust binary debugging and analysis

## Public API Surface

### Main Entry Points
- **Transport Commands**:
  - `handleStdioCommand(options: StdioOptions)`: Stdio transport mode (default)
  - `handleSSECommand(options: SSEOptions)`: HTTP-based SSE transport mode
  - `handleCheckRustBinaryCommand(binaryPath: string, options)`: Rust binary analysis utility

### Configuration Interfaces
- `StdioOptions`: Stdio transport configuration with logging controls
- `SSEOptions`: SSE transport configuration with port and logging settings
- `CheckRustBinaryOptions`: Binary analysis options with JSON output support

### Setup Functions
- `createCLI()`: CLI program factory
- `setupStdioCommand()`, `setupSSECommand()`, `setupCheckRustBinaryCommand()`: Command configuration functions
- `setupErrorHandlers()`: Global error handling initialization

## Internal Organization and Data Flow

### CLI Initialization Flow
1. **Program creation** via `createCLI()` with metadata setup
2. **Command registration** through setup functions that configure options and inject handlers
3. **Error handler installation** for process-level fault tolerance
4. **Command execution** with dependency injection and structured logging

### Transport Architecture
- **Shared server pattern**: Single DebugMcpServer instance serves multiple connections in SSE mode
- **Transport abstraction**: MCP SDK transports handle protocol details while commands manage lifecycle
- **Environment coordination**: Console output silencing prevents transport corruption

### Error and Lifecycle Management
- **Multi-level error handling**: Process-level handlers, transport error handling, and command-specific error management
- **Graceful shutdown**: Signal handling, transport cleanup, and coordinated server termination
- **Container awareness**: Keep-alive mechanisms and stdin handling for containerized deployment

## Important Patterns and Conventions

### Dependency Injection Architecture
- All major components accept dependencies through interfaces (logger, server factory, exit functions)
- Enables comprehensive testing and environment-specific behavior customization
- Consistent pattern across error handling, command handlers, and transport setup

### Transport Protocol Safety
- Explicit console output silencing for stdio/SSE modes to prevent protocol corruption
- Structured logging through Winston instead of console output
- Environment variable coordination (`CONSOLE_OUTPUT_SILENCED`) across the application

### Containerized Environment Handling
- Keep-alive intervals prevent premature container shutdown
- Robust signal handling for orchestration environments
- Graceful degradation when stdin/stdout behavior differs from standard terminals

### Consistent Command Interface
- Standardized logging options across all commands
- Async handler pattern with options and command object parameters
- JSON and human-readable output format support

This directory serves as the primary CLI interface for the Debug MCP server, providing production-ready command-line tools with robust error handling, multiple transport options, and specialized debugging utilities for Rust binary analysis.