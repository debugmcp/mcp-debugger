# src\utils\logger.ts
@source-hash: 260cc3323da692f6
@generated: 2026-02-19T23:47:39Z

## Purpose
Provides winston-based logging infrastructure for the Debug MCP Server with namespaced loggers, configurable transports, and environment-aware output handling.

## Key Components

### LoggerOptions Interface (L13-18)
Configuration interface for logger creation:
- `level`: Optional log level (error, warn, info, debug) 
- `file`: Optional custom file path for log output

### createLogger Function (L29-129)
Core logger factory that creates winston logger instances with:
- **Namespace support**: Each logger tagged with unique namespace for identification
- **Environment-aware console output**: Respects `CONSOLE_OUTPUT_SILENCED=1` to prevent stdout corruption during transport operations
- **Dual transport strategy**: Console (when not silenced) + file logging with rotation
- **Smart file path resolution**: Handles import.meta.url availability, container environments (`MCP_CONTAINER=true`), and fallback scenarios
- **File rotation**: 50MB per file, 3 rotated files maximum (150MB total)
- **Error handling**: Graceful degradation when file system operations fail

### getLogger Function (L135-141) 
Singleton accessor for default logger instance with lazy initialization fallback.

## Architecture Patterns

### Environment Detection
- `CONSOLE_OUTPUT_SILENCED=1`: Disables console transport to prevent stdout corruption
- `DEBUG_MCP_LOG_LEVEL`: Global log level override
- `MCP_CONTAINER=true`: Forces container-specific log path `/app/logs/`

### Path Resolution Strategy (L56-75)
1. Primary: Use import.meta.url to resolve relative to current file
2. Fallback: Use process.cwd() for test environments 
3. Container override: Force `/app/logs/` in containerized environments

### Transport Configuration
- **Console**: Colorized, timestamped format with namespace inclusion
- **File**: JSON format with automatic rotation and tailable logs
- **Error isolation**: File transport failures don't prevent logger creation

## Dependencies
- winston: Core logging framework
- Node.js fs/path: File system operations
- url.fileURLToPath: ES module path resolution

## Critical Invariants
- Console output must be completely suppressed when `CONSOLE_OUTPUT_SILENCED=1`
- Root logger (namespace='debug-mcp') becomes the default singleton
- Log directory creation is attempted but failure is non-fatal
- All error reporting respects console silencing to prevent transport corruption