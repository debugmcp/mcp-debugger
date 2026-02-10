# src/index.ts
@source-hash: 9465c92b70be787c
@generated: 2026-02-09T18:15:17Z

## Entry Point for Debug MCP Server

**Primary Purpose**: Main entry point that configures environment, initializes CLI, and bootstraps the Debug MCP Server with protocol-safe console handling.

### Critical Initialization Sequence

**Console Silencing (L7-34)**: IIFE that immediately silences all console output by overriding console methods with no-ops. This prevents stdout pollution that would corrupt MCP protocol communication and IPC channels in proxy processes. Sets `CONSOLE_OUTPUT_SILENCED=1` environment flag.

**Argument Cleaning (L36-39)**: Strips quotes from process.argv arguments before any processing occurs.

### Key Exports

**ServerOptions Interface (L57-60)**: Configuration interface with optional `logLevel` and `logFile` properties.

**createDebugMcpServer Factory (L62-65)**: Factory function that instantiates DebugMcpServer with provided options.

**main Function (L88-113)**: Primary execution orchestrator that:
- Creates logger instance
- Sets up error handlers via `setupErrorHandlers`
- Initializes CLI program with version and commands
- Configures stdio, SSE, and Rust binary check commands
- Parses command line arguments

### Container Diagnostics (L67-86)

Early breadcrumb logging for containerized environments when `MCP_CONTAINER=true`. Creates `/app/logs/bundle-start.log` with startup timestamps and argv for debugging bundled/Docker deployments.

### Module Detection & Auto-start (L115-146)

**isMainModule Detection (L118-135)**: Sophisticated main module detection that handles both ESM and CommonJS contexts, checking import.meta.url, require.main, and fallback conditions.

**Conditional Execution (L137-145)**: Auto-starts main() unless `DEBUG_MCP_SKIP_AUTO_START=1` is set. Error handling ensures process exits cleanly without console output.

### Dependencies

- **Core Components**: DebugMcpServer, logger utilities, CLI setup/handlers
- **CLI System**: Complete command setup for stdio, SSE, and Rust binary checking
- **Error Handling**: Centralized error handler setup

### Architectural Patterns

- **Environment-first Configuration**: Console silencing and environment setup before any imports
- **Factory Pattern**: Server instantiation through factory function
- **Dependency Injection**: CLI handlers receive logger and server factory
- **Protocol Safety**: Strict console output prevention for MCP compliance

### Re-exports (L148-158)

Exports CLI setup functions and handlers for testing and external consumption.