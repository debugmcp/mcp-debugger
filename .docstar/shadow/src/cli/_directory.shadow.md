# src\cli/
@generated: 2026-02-12T21:06:04Z

## Overall Purpose
The `src/cli` directory provides a complete command-line interface framework for a debugging MCP (Model Context Protocol) server. It implements multiple transport protocols (stdio, SSE) for MCP communication and includes specialized analysis commands for debugging compatibility assessment of software artifacts.

## Key Components and Architecture

### Transport Command Handlers
- **stdio-command.ts**: Implements stdio-based MCP transport for direct process communication, with robust container environment handling and graceful shutdown
- **sse-command.ts**: Provides HTTP/SSE-based MCP transport enabling web-based clients to connect via Server-Sent Events with POST message routing
- **commands/**: Directory containing specialized analysis commands (e.g., Rust binary inspection) with lazy-loaded adapters

### CLI Framework Infrastructure  
- **setup.ts**: Centralizes CLI configuration using Commander.js, providing standardized option patterns and command registration across all transport modes
- **version.ts**: Cross-environment version resolution supporting both CommonJS and ESM module systems
- **error-handlers.ts**: Global error handling setup with structured logging and fail-fast behavior for unhandled errors

## Public API Surface

### Main Entry Points
- `createCLI()`: Factory for Commander.js program instances with metadata
- `setupStdioCommand()`: Default stdio transport configuration (primary interface)
- `setupSSECommand()`: HTTP/SSE transport for web integration  
- `setupCheckRustBinaryCommand()`: Binary analysis command setup
- `handleStdioCommand()`: Stdio mode server execution
- `handleSSECommand()`: SSE mode server execution

### Configuration Interfaces
- **StdioOptions**: Logging configuration for stdio transport
- **SSEOptions**: Port and logging configuration for HTTP/SSE transport  
- **CheckRustBinaryOptions**: Analysis command options with JSON output support

## Internal Organization and Data Flow

### Dependency Injection Pattern
All command handlers accept dependency objects containing logger, server factory, and optional process exit functions, enabling comprehensive testing and modularity.

### Shared Server Architecture
- Stdio mode: One-to-one server-transport relationship
- SSE mode: Single shared DebugMcpServer instance serving multiple concurrent connections via session management

### Transport Lifecycle Management
1. **Setup Phase**: CLI parsing, logging configuration, dependency injection
2. **Server Creation**: Factory-based DebugMcpServer instantiation  
3. **Transport Binding**: Protocol-specific transport creation and connection
4. **Runtime Management**: Keep-alive mechanisms, session tracking, error handling
5. **Graceful Shutdown**: Signal handling, resource cleanup, process termination

### Analysis Command Flow
1. **Lazy Loading**: On-demand adapter module loading with build validation
2. **Input Processing**: File validation and analysis delegation  
3. **Output Formatting**: Dual-mode output (JSON/human-readable) with consistent schemas

## Important Patterns and Conventions

### Environment-Aware Operation
- `CONSOLE_OUTPUT_SILENCED` environment variable prevents transport corruption
- Cross-platform module system support (CommonJS/ESM)
- Container-optimized lifecycle management with keep-alive mechanisms

### Error Handling Strategy
- Process-level unhandled error termination via `error-handlers.ts`
- Transport-specific error isolation and logging
- User-friendly error messages with remediation guidance for missing dependencies

### Logging and Observability
- Winston-based structured logging throughout
- Configurable log levels and file output
- Health check endpoints for SSE mode monitoring

### Protocol Isolation
Each transport mode operates independently with consistent MCP server integration, allowing flexible deployment scenarios (direct stdio for CLI tools, HTTP/SSE for web applications) while maintaining the same underlying debugging capabilities.

## Critical Dependencies
- **@modelcontextprotocol/sdk**: Core MCP transport implementations
- **commander**: CLI argument parsing and command structure
- **express**: HTTP server for SSE transport
- **winston**: Structured logging
- **Internal server**: `../server.js` DebugMcpServer implementation