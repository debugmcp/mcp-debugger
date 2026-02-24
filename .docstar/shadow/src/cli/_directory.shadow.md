# src\cli/
@children-hash: 10b7aee803fec8a4
@generated: 2026-02-24T21:15:00Z

## Overall Purpose and Responsibility

The `src/cli` directory implements a comprehensive command-line interface for a Debug MCP (Model Context Protocol) Server system. This module provides multiple transport modes (stdio, SSE) for client-server communication and binary analysis utilities, with robust error handling and logging infrastructure suitable for both interactive and containerized environments.

## Key Components and Architecture

### Command Setup and Configuration (`setup.ts`)
Central command configuration factory using Commander.js framework:
- **createCLI()**: Main CLI program factory with metadata
- **Transport Commands**: Standardized setup for stdio (default) and SSE modes with consistent logging options
- **Analysis Commands**: Rust binary analysis with optional JSON output
- **Environment Control**: Console output silencing for transport protocol integrity

### Transport Command Handlers
**Stdio Mode (`stdio-command.ts`)**:
- Primary transport mode using stdin/stdout for MCP protocol communication
- Containerized environment support with keep-alive mechanisms and graceful signal handling
- Transport lifecycle management with deterministic shutdown patterns

**SSE Mode (`sse-command.ts`)**:
- HTTP-based transport using Server-Sent Events for server-to-client and POST for client-to-server
- Express application with session management and CORS support
- Shared server instance across multiple SSE connections with connection health monitoring

### Infrastructure Components
**Error Handling (`error-handlers.ts`)**:
- Global Node.js error handlers with structured Winston logging
- Different strategies for fatal (uncaught exceptions) vs non-fatal (unhandled rejections) errors
- Server-aware design preventing premature process termination

**Version Management (`version.ts`)**:
- Cross-environment version resolution supporting both CommonJS and ESM
- Multiple package.json search strategies with graceful fallback to default version
- Silent operation mode respecting environment variables

**Binary Analysis Commands (`commands/`)**:
- Rust executable analysis with lazy-loaded optional dependencies
- Support for both programmatic (JSON) and human-readable output formats
- Toolchain-aware processing with compatibility assessments

## Public API Surface

### Main Entry Points
- **Default Command**: `stdio` mode for standard MCP protocol communication
- **SSE Command**: HTTP-based transport on configurable port (default 3001)
- **check-rust-binary**: Binary analysis utility for Rust executables
- **createCLI()**: CLI program factory for external integration

### Configuration Interfaces
- **StdioOptions**: Log level and file configuration for stdio transport
- **SSEOptions**: Port, logging configuration for HTTP transport
- **CheckRustBinaryOptions**: Binary analysis with optional JSON output

### Dependencies and Integration Points
- **DebugMcpServer**: Core server implementation from `../server.js`
- **MCP SDK**: Protocol transport implementations
- **Winston Logger**: Structured logging throughout
- **Express**: HTTP server for SSE transport mode

## Internal Organization and Data Flow

1. **CLI Initialization**: Command setup with standardized option patterns and handler injection
2. **Transport Selection**: User chooses stdio (default) or SSE mode based on use case
3. **Server Lifecycle**: DebugMcpServer creation, transport connection, and graceful shutdown coordination
4. **Error Management**: Global error handlers with structured logging and appropriate exit strategies
5. **Binary Analysis**: Optional utility commands with lazy dependency loading and formatted output

## Important Patterns and Conventions

### Dependency Injection Architecture
All command handlers accept dependencies (logger, serverFactory, exitProcess) enabling testability and flexible deployment configurations.

### Transport Protocol Safety
Console output silencing (`CONSOLE_OUTPUT_SILENCED`) prevents corruption of stdio/SSE transport protocols while maintaining diagnostic logging capabilities.

### Graceful Shutdown Strategies
- Signal handling for containerized environments (SIGTERM/SIGINT)
- Connection cleanup with recursion protection
- Deterministic process lifecycle management

### Error Handling Philosophy
- Structured logging with metadata over console output
- Different handling for fatal vs recoverable errors
- User-friendly error messages with actionable remediation steps

This CLI module serves as the primary user interface for the Debug MCP Server, providing flexible deployment options for different environments (interactive terminals, containers, web-based clients) while maintaining protocol integrity and operational reliability.