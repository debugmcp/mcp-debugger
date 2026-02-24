# src\cli/
@children-hash: b2256b6f46113690
@generated: 2026-02-24T18:27:04Z

## Overall Purpose and Responsibility

The `src/cli` directory provides a comprehensive command-line interface for a debugging MCP (Model Context Protocol) server system. It orchestrates multiple transport modes (stdio and SSE), implements global error handling, and provides specialized tools for analyzing Rust executables. The module serves as the primary user-facing entry point for the debugging MCP adapter system.

## Key Components and Architecture

### Command Setup Framework (`setup.ts`)
Central configuration hub that defines CLI structure using Commander.js:
- **Transport Commands**: Standardized stdio and SSE command configurations with consistent logging options
- **Analysis Commands**: Rust binary analysis tooling with flexible output formats
- **Option Patterns**: Unified approach to log levels, file output, and console management
- **Environment Control**: Manages `CONSOLE_OUTPUT_SILENCED` for transport protocol protection

### Transport Handlers
**Stdio Mode (`stdio-command.ts`)**:
- Primary transport for MCP server communication via standard input/output
- Container-aware lifecycle management with keep-alive mechanisms
- Graceful shutdown handling for orchestrated environments

**SSE Mode (`sse-command.ts`)**:
- HTTP-based Server-Sent Events transport for web integration
- Shared MCP server instance serving multiple concurrent connections
- Session-based message routing with health monitoring endpoints

### Error Management (`error-handlers.ts`)
Global Node.js error handling system:
- Structured logging for uncaught exceptions and unhandled rejections
- Differentiated handling strategies (fatal vs non-fatal errors)
- Server-optimized design preventing premature process termination

### Utility Services
**Version Resolution (`version.ts`)**: Cross-environment package.json version detection with multiple fallback strategies

**Command Handlers (`commands/`)**: Specialized CLI commands for Rust binary analysis with lazy loading and graceful dependency management

## Public API Surface

### Main Entry Points
- `createCLI()`: Factory function for Commander.js program instances
- `setupStdioCommand()`: Default transport command configuration
- `setupSSECommand()`: Web-based transport command setup
- `setupCheckRustBinaryCommand()`: Binary analysis command configuration
- `handleStdioCommand()`: Stdio transport execution handler
- `handleSSECommand()`: SSE transport execution handler
- `setupErrorHandlers()`: Global error handling initialization

### Configuration Interfaces
- `StdioOptions`: Stdio transport configuration with logging controls
- `SSEOptions`: SSE transport settings including port and logging
- `CheckRustBinaryOptions`: Binary analysis options with output formatting

## Internal Organization and Data Flow

1. **CLI Initialization**: Commander.js program creation with metadata and version resolution
2. **Command Registration**: Setup functions configure commands with options and handlers
3. **Transport Selection**: User chooses between stdio (default) or SSE transport modes
4. **Server Instantiation**: Shared or dedicated MCP server instances based on transport type
5. **Error Handling Setup**: Global process event handlers for robust error management
6. **Protocol Operation**: Transport-specific message handling and lifecycle management
7. **Graceful Shutdown**: Coordinated cleanup of connections, servers, and resources

## Important Patterns and Conventions

### Transport Isolation
- Console output silencing prevents interference with stdio/SSE protocols
- Environment-based control mechanisms coordinate logging behavior
- Transport-specific lifecycle management strategies

### Dependency Injection Architecture
- Handler functions accept configuration and dependencies for testability
- Optional exit functions and loggers enable testing and customization
- Factory patterns for server and transport instantiation

### Container-Aware Design
- Keep-alive mechanisms prevent premature container shutdown
- Signal handling for orchestrated environment compatibility
- Robust connection cleanup with recursion guards

### Error Resilience
- Graceful degradation for missing optional dependencies
- Structured error reporting with actionable remediation guidance
- Multiple fallback strategies for critical operations

This directory serves as the unified CLI gateway to the debugging MCP system, providing a clean separation between user interface concerns and core protocol implementation while maintaining robust error handling and transport flexibility.