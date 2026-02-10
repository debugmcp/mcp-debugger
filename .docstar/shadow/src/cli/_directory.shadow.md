# src/cli/
@generated: 2026-02-10T01:19:55Z

## Purpose
The `src/cli` directory provides the command-line interface layer for a Debug MCP (Model Context Protocol) server system. It implements a multi-transport server architecture with standardized CLI commands, centralized error handling, and binary analysis capabilities for debugging workflows.

## Core Architecture

### Multi-Transport Server System
The CLI supports three primary operational modes:
- **stdio**: Default mode using stdin/stdout transport for direct process communication
- **sse**: HTTP-based Server-Sent Events transport enabling web-based client connections
- **check-rust-binary**: Binary analysis mode for examining Rust executable debugging information

### Key Components and Relationships

#### Command Setup and Configuration (`setup.ts`)
Central CLI framework using Commander.js that:
- Provides factory function `createCLI()` for program initialization
- Implements consistent option patterns across all commands (logging, ports, output formats)
- Manages environment-based console silencing for transport protection
- Supports dependency injection for testable command handlers

#### Transport Commands
- **`stdio-command.ts`**: Implements stdio transport with containerized environment handling, keep-alive mechanisms, and graceful shutdown
- **`sse-command.ts`**: Provides HTTP/SSE transport with shared server model, session management, and CORS support

#### Binary Analysis (`commands/`)
Modular command handlers for development artifact analysis:
- Lazy-loaded analysis modules for performance optimization
- Standardized dual-format output (JSON/human-readable)
- File system validation and error handling

#### Infrastructure Components
- **`error-handlers.ts`**: Global process-level error handling with structured logging and fail-fast behavior
- **`version.ts`**: Cross-environment version resolution supporting both CommonJS and ESM

## Public API Surface

### Main Entry Points
- `createCLI()`: CLI program factory with metadata configuration
- `setupStdioCommand(handler)`: Configures default stdio transport command
- `setupSSECommand(handler)`: Configures HTTP/SSE transport command
- `setupCheckRustBinaryCommand(handler)`: Configures binary analysis command
- `setupErrorHandlers(dependencies)`: Global error handling setup

### Transport Handlers
- `handleStdioCommand(options, command)`: Stdio mode server execution
- `handleSSECommand(options, command)`: SSE mode server execution
- Binary analysis handlers in `commands/` subdirectory

## Internal Organization and Data Flow

### Dependency Injection Pattern
All components use dependency injection interfaces for testability:
- Logger instances for structured logging
- Server factory functions for Debug MCP server creation
- Optional process exit handlers for testing scenarios

### Server Lifecycle Management
1. **Setup Phase**: CLI parsing, option validation, logger configuration
2. **Transport Phase**: Protocol-specific transport creation and MCP server connection
3. **Runtime Phase**: Keep-alive mechanisms, session management, signal handling
4. **Shutdown Phase**: Graceful cleanup of transports, connections, and process exit

### Shared Infrastructure
- **Logging Strategy**: Winston-based structured logging with level control and optional file output
- **Environment Coordination**: `CONSOLE_OUTPUT_SILENCED` environment variable prevents transport corruption
- **Error Handling**: Centralized unhandled error processing with immediate process termination

## Important Patterns and Conventions

### Transport Protection
Commands that establish communication protocols (stdio/SSE) explicitly silence console output to prevent corruption of the transport layer.

### Graceful Shutdown
Comprehensive shutdown handling supporting:
- Signal-based termination (SIGINT/SIGTERM)
- Transport-initiated shutdown
- Container environment compatibility
- Connection cleanup and resource disposal

### Cross-Platform Compatibility
- ESM/CommonJS module system support
- Container-aware stdio handling
- Cross-origin resource sharing for web-based clients

### Performance Optimization
- Lazy loading of heavyweight analysis modules
- Shared server instances for multiple SSE connections
- Efficient session management with cleanup protection

This CLI layer abstracts the complexity of MCP server operation into user-friendly commands while maintaining robust error handling, transport isolation, and development workflow integration.