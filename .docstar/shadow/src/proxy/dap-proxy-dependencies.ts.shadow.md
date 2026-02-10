# src/proxy/dap-proxy-dependencies.ts
@source-hash: d86010d2291b5308
@generated: 2026-02-10T01:18:55Z

## DAP Proxy Dependencies Factory

Production dependency injection factory for the DAP (Debug Adapter Protocol) Proxy Worker. Provides concrete implementations of external dependencies to enable worker process isolation and testability.

### Key Functions

**createProductionDependencies() (L19-55)**
- Primary factory function returning DapProxyDependencies object with production implementations
- Creates logger factory for session-specific file logging with delayed initialization (L21-27)
- Provides fs-extra wrappers for file system operations (L32-35)
- Exposes child_process.spawn for process spawning (L37-39)
- Creates MinimalDapClient factory with type compatibility workaround (L41-43)
- Implements message sender supporting both IPC and stdout fallback (L45-53)

**createConsoleLogger() (L60-67)**
- Simple pre-initialization logger using console methods
- All log levels route to console.log/console.error for early error handling

**setupGlobalErrorHandlers() (L72-109)**
- Registers process-level error handlers for worker process robustness
- Handles uncaughtException and unhandledRejection with structured error messages (L78-96)
- Implements graceful shutdown on SIGINT/SIGTERM signals (L98-108)
- Sends error notifications via message sender before process termination

### Dependencies

- `child_process.spawn` - Process spawning capability
- `fs-extra` - Enhanced file system operations
- `MinimalDapClient` - DAP client implementation
- `createLogger` - Session-specific file logging
- `DapProxyDependencies` interface - Dependency contract definition

### Architecture Notes

- Uses dependency injection pattern to enable testing and modularity
- Worker process operates in isolated environment with structured communication
- Dual message transport: IPC when available, stdout fallback for broader compatibility
- Session-based logging with predictable file naming pattern
- Type compatibility issue acknowledged with explicit any casting for DAP client

### Critical Behavior

- Process exits with code 1 on unhandled errors after cleanup
- Graceful shutdown (code 0) on termination signals
- Message sender automatically detects IPC vs stdout mode
- Logger factory creates session-scoped loggers in specified directory