# src\proxy\dap-proxy-core.ts
@source-hash: 059cb76ccd7c4807
@generated: 2026-02-24T01:54:18Z

## Purpose
Core DAP (Debug Adapter Protocol) proxy orchestration class providing programmatic control over proxy lifecycle, communication channels, and command processing without auto-execution.

## Key Classes & Interfaces

**ProxyRunner (L41-348)**: Main orchestration class managing proxy worker lifecycle and communication channels
- Constructor (L52-59): Accepts dependencies, logger, and options; creates DapProxyWorker instance
- `start()` (L64-121): Initializes communication channels (IPC/stdin), sets up heartbeat monitoring, and initialization timeout (10s default)
- `stop()` (L126-152): Graceful shutdown with resource cleanup and worker termination
- `getWorkerState()` (L157-159): Returns current ProxyState from worker
- `setupGlobalErrorHandlers()` (L300-347): Installs process-level error handling for uncaught exceptions, rejections, and signals

**ProxyRunnerOptions (L20-35)**: Configuration interface for communication preferences
- `useIPC?: boolean`: Enable IPC communication when available
- `useStdin?: boolean`: Enable stdin/readline fallback
- `onMessage?: (message: string) => Promise<void>`: Custom message handler for testing

## Communication Management

**IPC Communication (L213-280)**:
- Validates `process.send` availability before setup
- Implements heartbeat system with 5-second intervals (L88-103)
- Handles both string and object message types with JSON serialization
- Tracks message counters for debugging

**Stdin Communication (L285-295)**:
- Readline interface with terminal: false for programmatic use
- Line-based message processing

**Message Processing (L171-208)**:
- Uses MessageParser to parse ParentCommand from input
- Clears initialization timeout on 'init' command receipt
- Forwards commands to DapProxyWorker
- Handles TERMINATED state with configurable exit delays (500ms for dry runs)

## Dependencies & Architecture

**Core Dependencies**:
- `DapProxyWorker`: Handles actual DAP command processing and adapter management
- `MessageParser`: Parses incoming command strings into structured ParentCommand objects
- `DapProxyDependencies`: Injected dependencies including messageSender for responses

**Error Handling**:
- Global process error handlers with graceful shutdown
- Sanitized logging via `sanitizePayloadForLogging`
- Session-aware error reporting to parent process

## Execution Mode Detection

**detectExecutionMode() (L353-366)**: Determines runtime context
- Checks if module is directly executed vs imported
- Detects IPC channel availability
- Reads DAP_PROXY_WORKER environment variable

**shouldAutoExecute() (L371-372)**: Decision logic for automatic proxy startup based on execution mode

## Critical Patterns

1. **Initialization Timeout**: 10-second timeout prevents orphaned processes (L108-115)
2. **Heartbeat System**: Regular IPC heartbeats ensure parent-child connection health
3. **Graceful Shutdown**: Proper cleanup of intervals, listeners, and worker state
4. **Dual Communication**: IPC preferred, stdin fallback for compatibility
5. **State-driven Exit**: Worker TERMINATED state triggers process exit with delays for dry runs

## Runtime Invariants

- Only one communication channel active at a time (IPC takes precedence)
- Initialization timeout cleared only on successful 'init' command
- Worker state drives proxy lifecycle decisions
- All errors forwarded to parent via messageSender with session context