# src/proxy/dap-proxy-entry.ts
@source-hash: 20e6fcc1abc4cae4
@generated: 2026-02-10T00:41:50Z

## Primary Purpose
Production entry point for DAP (Debug Adapter Protocol) proxy worker process. Handles environment detection and conditionally auto-starts the proxy runner based on execution context.

## Key Components

### Execution Detection (L19-20)
- `detectExecutionMode()`: Analyzes how the process was started (direct execution, IPC spawn, or environment flag)
- Returns execution mode object with boolean flags for different detection methods

### Auto-execution Logic (L28-53)
- `shouldAutoExecute()` (L28): Determines if proxy should start automatically based on execution mode
- Only executes when running as a worker process (bypasses test environment checks per L27 comment)
- Creates production dependencies and console logger (L32-33)
- Instantiates `ProxyRunner` with dependencies (L36)

### Error Handling Setup (L38-42)
- Configures global error handlers via `runner.setupGlobalErrorHandlers()`
- Stop callback: `() => runner.stop()`
- Session ID accessor: Accesses private `currentSessionId` field via bracket notation for error reporting

### Process Lifecycle (L44-48)
- Starts runner asynchronously with `.start()`
- On failure: logs error and exits with code 1
- On success: logs ready message (L50)

## Dependencies
- `dap-proxy-core.js`: Core proxy functionality (`ProxyRunner`, detection utilities)
- `dap-proxy-dependencies.js`: Production dependency injection and logging setup

## Architectural Decisions
- **Environment-aware startup**: Uses multiple detection methods for flexible deployment
- **Production-only scope**: Explicitly bypasses test environment considerations
- **Dependency injection**: Separates concerns by injecting dependencies rather than hardcoding
- **Global error handling**: Centralizes error management for the worker process
- **Console-based logging**: Uses `console.error` for worker process communication

## Critical Constraints
- Auto-execution only occurs when `shouldAutoExecute()` returns true
- Private field access pattern used for session ID retrieval in error contexts
- Process exits with code 1 on startup failure