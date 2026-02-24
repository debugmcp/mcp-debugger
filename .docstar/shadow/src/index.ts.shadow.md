# src\index.ts
@source-hash: 58fb33d95769a637
@generated: 2026-02-24T18:26:36Z

## Debug MCP Server Entry Point

Main entry point for the Debug MCP Server that provides step-through debugging capabilities for LLMs via MCP protocol.

### Critical Console Silencing (L12-34)
The file immediately silences all console output via an IIFE to prevent stdout pollution that could:
- Break MCP protocol in stdio mode  
- Corrupt IPC channels in SSE mode with proxy processes

Sets `process.env.CONSOLE_OUTPUT_SILENCED = '1'` and overrides all console methods with no-ops. Also suppresses process warnings.

### Argument Processing (L36-39)
Cleans `process.argv` by stripping quotes from all arguments before any code processes them.

### Core Exports

**ServerOptions Interface (L57-60)**: Configuration options with optional `logLevel` and `logFile` properties.

**createDebugMcpServer() (L63-65)**: Factory function that creates `DebugMcpServer` instances from options.

**main() (L89-113)**: Primary execution function that:
- Creates logger and sets up error handlers
- Initializes CLI with commands (stdio, SSE, check-rust-binary)
- Parses command line arguments

### Container Diagnostics (L71-86)
When `MCP_CONTAINER=true`, writes early startup breadcrumbs to `/app/logs/bundle-start.log` for container debugging without console output.

### Module Detection & Auto-Start (L118-146)
Complex logic to detect if running as main module in both ESM and CJS contexts:
- Checks `require.main === module` for CJS (bundled)
- Compares `import.meta.url` with `process.argv[1]` for ESM
- Falls back to assuming main module if detection fails

Auto-starts `main()` unless `DEBUG_MCP_SKIP_AUTO_START=1` environment variable is set.

### Dependencies
- `DebugMcpServer` from `./server.js`
- CLI setup utilities from `./cli/setup.js`
- Command handlers for stdio, SSE, and Rust binary checking
- Logger utilities

### Architecture Notes
- Prioritizes protocol integrity over debugging convenience by silencing all console output
- Supports both stdio and SSE transport modes
- Handles both bundled (CJS) and native ESM execution contexts
- Provides factory pattern for server instantiation