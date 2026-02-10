# src/cli/stdio-command.ts
@source-hash: ca130161515b64ec
@generated: 2026-02-09T18:15:01Z

## Purpose
CLI command handler for starting a Debug MCP Server in stdio mode, managing the connection between the server and stdin/stdout transport with robust lifecycle management.

## Key Interfaces & Types
- `ServerFactoryOptions` (L6-9): Configuration for server factory with optional logLevel and logFile
- `StdioCommandDependencies` (L11-15): Dependency injection interface containing logger, serverFactory function, and optional exitProcess override

## Core Function
- `handleStdioCommand` (L17-102): Main async handler that orchestrates the stdio server startup process

## Key Dependencies
- `StdioServerTransport` from MCP SDK: Handles stdin/stdout communication protocol
- `DebugMcpServer`: The actual MCP server instance being managed
- `WinstonLoggerType`: Logging interface

## Architecture & Flow
1. **Initialization** (L21-27): Sets up logger level and logs startup message
2. **Server Creation** (L31-34): Uses injected factory to create DebugMcpServer instance
3. **Transport Setup** (L37-46): Creates StdioServerTransport and connects server to it
4. **Lifecycle Management** (L41-96):
   - Keep-alive interval (L41) prevents premature exit in detached containers
   - Transport close handler (L49-54) ensures clean shutdown
   - Stdin management (L66-76) with policy to ignore stdin end in containerized environments
   - Signal handlers (L79-88) for SIGTERM/SIGINT with cleanup
   - Exit diagnostics (L89-96) for debugging

## Critical Patterns
- **Dependency Injection**: Uses injected dependencies for testability (logger, serverFactory, exitProcess)
- **Robust Error Handling**: Try-catch wrapper with appropriate exit codes
- **Container-Aware Design**: Handles detached container scenarios where stdin may close unexpectedly
- **Protocol Safety**: Careful handling of console output to avoid corrupting MCP transport

## Important Constraints
- Console output must be avoided when `CONSOLE_OUTPUT_SILENCED` to prevent transport corruption
- Keep-alive mechanism is essential for containerized deployments
- Transport close is the authoritative shutdown trigger, not stdin end