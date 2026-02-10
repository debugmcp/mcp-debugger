# src/utils/logger.ts
@source-hash: 3a4a195c28bd0d21
@generated: 2026-02-09T18:15:07Z

## Logger Utility for Debug MCP Server

**Primary Purpose**: Provides a Winston-based logging system with environment-aware console output control and file logging capabilities for the Debug MCP Server.

### Key Components

**LoggerOptions Interface (L13-18)**: Configuration interface with optional `level` (error/warn/info/debug) and `file` path properties.

**createLogger Function (L29-126)**: Main factory function that creates configured Winston loggers with:
- Namespace-based identification for log categorization
- Environment variable support (`DEBUG_MCP_LOG_LEVEL`, `CONSOLE_OUTPUT_SILENCED`, `MCP_CONTAINER`)
- Conditional console transport - completely disabled when `CONSOLE_OUTPUT_SILENCED=1` to prevent stdout corruption
- File transport with JSON formatting and automatic directory creation
- Fallback path resolution using `import.meta.url` with graceful degradation for test environments

**getLogger Function (L132-138)**: Provides access to default logger instance, creates fallback logger if none exists.

### Critical Environment Handling

**Console Output Silencing (L36, L38, L84, L101, L115)**: Strict enforcement of no stdout writes when `CONSOLE_OUTPUT_SILENCED=1` to prevent transport corruption.

**Container Runtime Support (L72-74)**: Redirects logs to `/app/logs/` when `MCP_CONTAINER=true` for centralized container log collection.

**Path Resolution Strategy (L55-69)**: Robust fallback chain:
1. `import.meta.url` + relative path resolution
2. `process.cwd()` fallback for test environments
3. Exception handling for import.meta failures

### Dependencies
- `winston`: Core logging framework
- `path`, `fs`: File system operations for log directory management
- `url`: ES module path resolution

### Architecture Notes
- Singleton pattern for default logger (L20, L121-123)
- Error handling with environment-aware console output
- Transport-level error handling with winston error event listener (L113-118)
- Graceful degradation for various runtime environments (Node.js, containers, tests)