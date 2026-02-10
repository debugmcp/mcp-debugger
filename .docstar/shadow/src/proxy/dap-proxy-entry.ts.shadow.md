# src/proxy/dap-proxy-entry.ts
@source-hash: 20e6fcc1abc4cae4
@generated: 2026-02-09T18:15:02Z

## Purpose
Production entry point for DAP (Debug Adapter Protocol) proxy worker process. Handles automatic detection of execution context and conditionally starts the proxy runner based on how the process was launched.

## Key Components

### Execution Detection (L19-20)
- Uses `detectExecutionMode()` to identify how the process was started
- Returns object with flags: `isDirectRun`, `hasIPC`, `isWorkerEnv`

### Auto-execution Logic (L28-53)
- Conditional startup using `shouldAutoExecute(executionMode)` (L28)
- Only runs when detected as worker process (bypasses test environment checks)
- Creates production dependencies and console logger (L32-33)
- Instantiates `ProxyRunner` with dependencies (L36)

### Error Handling Setup (L38-42)
- Configures global error handlers via `runner.setupGlobalErrorHandlers()`
- Stop callback: `() => runner.stop()`
- Session ID accessor: Accesses private `currentSessionId` field from worker

### Process Lifecycle (L45-48)
- Async start with error handling
- Process exit on startup failure
- Ready confirmation logging

## Dependencies
- `./dap-proxy-core.js`: Core proxy functionality and execution detection
- `./dap-proxy-dependencies.js`: Dependency injection and logging utilities

## Architecture Notes
- **No test environment detection**: Explicit comment indicates production-only behavior (L27)
- **Private field access**: Direct access to worker's private `currentSessionId` for error reporting (L41)
- **Console logging**: Extensive stderr logging for process visibility and debugging
- **Conditional execution**: Safe to import without side effects - only executes when appropriate

## Process Flow
1. Detect execution mode and log diagnostics
2. Check if should auto-execute based on worker context
3. If worker: create dependencies → instantiate runner → setup error handlers → start
4. If not worker: log and exit without action