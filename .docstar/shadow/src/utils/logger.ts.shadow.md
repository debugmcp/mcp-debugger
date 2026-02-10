# src/utils/logger.ts
@source-hash: 3a4a195c28bd0d21
@generated: 2026-02-10T00:41:58Z

Logger utility module for the Debug MCP Server that provides Winston-based logging with configurable transports and environment-specific behavior.

## Core Interface
- `LoggerOptions` (L13-18): Configuration interface accepting optional `level` and `file` path parameters

## Primary Functions
- `createLogger(namespace, options)` (L29-126): Factory function that creates Winston logger instances with namespace-specific configuration. Handles console output silencing via `CONSOLE_OUTPUT_SILENCED` environment variable and container runtime detection via `MCP_CONTAINER`. Sets up both console and file transports with different formatting (colorized console vs JSON file).
- `getLogger()` (L132-138): Singleton accessor that returns the default logger instance, creating a fallback if none exists

## Key Architecture Decisions
- **Console Silencing**: Critical pattern throughout the module - console output is completely suppressed when `CONSOLE_OUTPUT_SILENCED=1` to prevent transport corruption (L36-38, L83-87, L100-104, L114-118)
- **Root Logger Detection**: Special handling for 'debug-mcp' namespace as default logger (L121-123)
- **Path Resolution Strategy**: Multi-fallback approach for log file paths:
  1. Uses `import.meta.url` with fileURLToPath conversion (L58-61)
  2. Falls back to `process.cwd()` if import.meta unavailable (L63-68)
  3. Container-specific path `/app/logs/debug-mcp-server.log` when `MCP_CONTAINER=true` (L72-74)

## Dependencies
- Winston logging library with typed imports
- Node.js built-ins: path, fs, url (fileURLToPath)

## State Management
- `defaultLogger` module-level singleton (L20) for shared logger instance

## Error Handling
- Graceful degradation for directory creation failures (L77-87)
- File transport creation error handling (L99-104)
- Winston internal error event handling (L113-118)
- All error outputs respect console silencing constraint

## Log Configuration
- Level precedence: options.level > `DEBUG_MCP_LOG_LEVEL` env var > 'info' default (L31)
- Default log path: `../../logs/debug-mcp-server.log` relative to module location
- Console format: colorized with timestamp and namespace
- File format: JSON with timestamp for structured logging