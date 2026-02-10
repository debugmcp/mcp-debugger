# src/proxy/dap-proxy-dependencies.ts
@source-hash: 3f59d69171b3fae9
@generated: 2026-02-09T18:15:04Z

## Primary Purpose
Dependency injection factory for DAP (Debug Adapter Protocol) proxy worker processes. Provides production implementations of file system operations, process spawning, logging, DAP client creation, and inter-process communication.

## Key Exports

### createProductionDependencies() (L19-55)
Factory function that returns a `DapProxyDependencies` object containing all runtime dependencies:
- **loggerFactory**: Async factory creating session-specific loggers with file output to `proxy-{sessionId}.log` (L21-27)
- **fileSystem**: Wrapper around fs-extra for directory operations (L32-35)
- **processSpawner**: Direct binding to Node.js `spawn` function (L37-39) 
- **dapClientFactory**: Creates MinimalDapClient instances with type coercion workaround (L41-43)
- **messageSender**: IPC abstraction using `process.send()` or stdout fallback (L45-53)

### createConsoleLogger() (L60-67)
Simple logger implementation routing all levels to `console.error` with prefixed labels. Used for pre-initialization error reporting.

### setupGlobalErrorHandlers() (L72-109)
Comprehensive process-level error handling setup:
- **Uncaught exceptions**: Logs error, sends IPC message, triggers shutdown (L78-86)
- **Unhandled rejections**: Similar handling for promise rejections (L88-96)
- **SIGINT/SIGTERM**: Graceful shutdown on process signals (L98-108)

## Dependencies
- `child_process.spawn`: Process creation
- `fs-extra`: Enhanced file system operations
- `path`: Path manipulation utilities
- `MinimalDapClient`: Local DAP client implementation
- `createLogger`: Utility logger factory
- Interface types from `dap-proxy-interfaces.js`

## Architecture Notes
- Uses dependency injection pattern for testability
- Message sender abstracts IPC vs stdout communication
- Type coercion used for DAP client due to interface compatibility issues
- All logging routed through stderr to avoid stdout interference
- Graceful shutdown pattern with cleanup callbacks

## Critical Behaviors
- Logger factory creates session-scoped log files in specified directory
- Message sender falls back to stdout JSON when `process.send` unavailable
- Global error handlers always exit process after cleanup
- All console logging uses stderr to preserve stdout for data communication