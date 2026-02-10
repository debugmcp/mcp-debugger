# src/proxy/dap-proxy-core.ts
@source-hash: 0cf504d5204183e7
@generated: 2026-02-10T00:41:56Z

## Core DAP Proxy Runner - Pure Business Logic

This module provides the main orchestration logic for a Debug Adapter Protocol (DAP) proxy system, designed for programmatic control without auto-execution side effects.

### Primary Components

**ProxyRunnerOptions Interface (L19-34)**
Configuration interface defining communication preferences:
- `useIPC?: boolean` - Enable IPC communication when available
- `useStdin?: boolean` - Enable stdin/readline fallback
- `onMessage?: (message: string) => Promise<void>` - Custom message handler for testing

**ProxyRunner Class (L40-347)**
Main orchestrator managing proxy lifecycle and communication channels:
- **Constructor (L51-58)**: Initializes with dependencies, logger, and options
- **State Management**: Tracks running status, timeouts, counters
- **Communication**: Supports both IPC and stdin/readline channels

### Key Methods

**Lifecycle Management:**
- `start() (L63-120)`: Initializes communication channels, sets up heartbeat, configures 10-second initialization timeout
- `stop() (L125-151)`: Graceful shutdown with resource cleanup
- `getWorkerState() (L156-158)`: Returns current ProxyState
- `getWorker() (L163-165)`: Exposes worker instance for testing

**Message Processing:**
- `createMessageProcessor() (L170-207)`: Creates default message handler that parses commands, clears init timeout, handles termination
- Processes both string and object messages via MessageParser
- Implements exit logic based on worker state (immediate for normal, 500ms delay for dry runs)

**Communication Setup:**
- `setupIPCCommunication() (L212-279)`: Configures IPC with heartbeat, message counting, connection monitoring
- `setupStdinCommunication() (L284-294)`: Sets up readline interface for stdin input
- `setupGlobalErrorHandlers() (L299-346)`: Installs process-level error handlers for uncaught exceptions, rejections, and signals

### Dependencies & Architecture

**Core Dependencies:**
- `DapProxyWorker`: Handles actual command execution
- `MessageParser`: Parses incoming command strings
- `DapProxyDependencies`: Injection container for external dependencies
- `ILogger`: Logging abstraction

**Communication Pattern:**
Dual-channel support with automatic fallback: IPC preferred, stdin/readline as backup. Includes comprehensive error handling and process lifecycle management.

### Utility Functions

**detectExecutionMode() (L352-365)**
Environment detection logic checking:
- Direct script execution via require.main or import.meta
- IPC channel availability
- Worker environment flag

**shouldAutoExecute() (L370-371)**
Decision logic for auto-execution based on execution context

### Critical Behaviors

- **Initialization Timeout**: 10-second timeout prevents orphaned processes (L108-114)
- **Heartbeat System**: 5-second interval heartbeat when IPC available (L87-102)
- **Graceful Termination**: Handles SIGTERM/SIGINT with proper cleanup
- **Error Recovery**: Comprehensive error handling with session-aware error reporting
- **Resource Management**: Proper cleanup of intervals, listeners, and readline interfaces