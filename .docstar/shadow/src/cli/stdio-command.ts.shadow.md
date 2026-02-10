# src/cli/stdio-command.ts
@source-hash: ca130161515b64ec
@generated: 2026-02-10T00:41:52Z

## Primary Purpose
Command handler for stdio mode operation of a Debug MCP (Model Context Protocol) Server. Establishes stdio transport, manages server lifecycle, and handles graceful shutdown with robust signal handling for containerized environments.

## Key Interfaces & Functions

### `ServerFactoryOptions` (L6-9)
Configuration interface for server creation:
- `logLevel`: Optional logging verbosity control
- `logFile`: Optional log output destination

### `StdioCommandDependencies` (L11-15) 
Dependency injection interface enabling testability:
- `logger`: Winston logger instance for diagnostics
- `serverFactory`: Factory function creating DebugMcpServer instances
- `exitProcess`: Optional process exit handler (defaults to `process.exit`)

### `handleStdioCommand()` (L17-102)
Main async command handler orchestrating stdio mode server startup:
- **Input validation & setup** (L21-27): Configures logger level from options
- **Server creation** (L31-34): Uses factory pattern to instantiate DebugMcpServer
- **Transport setup** (L37-46): Creates StdioServerTransport and establishes MCP connection
- **Keep-alive mechanism** (L41): 60-second interval prevents premature container shutdown
- **Shutdown handlers** (L49-54, L79-88): Manages transport close and signal-based termination
- **Error handling** (L61-63, L97-101): Transport errors and startup failures

## Architecture & Dependencies
- **MCP SDK**: Uses `@modelcontextprotocol/sdk/server/stdio.js` for protocol transport
- **Internal server**: Depends on `../server.js` DebugMcpServer implementation
- **CLI integration**: Consumes `StdioOptions` from `./setup.js`
- **Logging**: Winston-based structured logging throughout

## Critical Patterns

### Containerized Environment Handling
- Keep-alive interval (L41) prevents Node.js exit in detached containers
- Stdin end handling (L74-76) ignores unexpected stdin closure in containers
- Transport-based lifecycle management over stdin-based termination

### Graceful Shutdown Strategy
- Multiple exit paths: transport close (L50-54), SIGTERM/SIGINT (L79-88)
- Consistent cleanup: `clearInterval(keepAlive)` + `exitProcess(0)`
- Process exit diagnostics (L89-96) with environment context

### Protocol Safety
- Console output silencing awareness (L99) to prevent transport corruption
- Structured error logging instead of console output
- Transport error isolation (L61-63)

## Key Constraints
- Must not corrupt stdio transport with console output
- Requires deterministic shutdown for container orchestration
- Transport lifecycle controls server lifetime, not process signals alone