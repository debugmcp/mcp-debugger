# src/proxy/dap-proxy-core.ts
@source-hash: 0cf504d5204183e7
@generated: 2026-02-09T18:15:07Z

## DAP Proxy Core - Programmatic Proxy Runner

Core module providing a pure business logic proxy runner implementation without auto-execution side effects. Encapsulates all DAP (Debug Adapter Protocol) proxy functionality in a controllable class interface.

### Primary Components

**ProxyRunnerOptions Interface (L19-34)**
Configuration interface supporting:
- `useIPC`: Enable IPC communication when available
- `useStdin`: Enable stdin/readline fallback
- `onMessage`: Custom message handler for testing

**ProxyRunner Class (L40-346)**
Main proxy orchestration class managing communication channels and worker lifecycle:
- Encapsulates `DapProxyWorker` instance and message routing
- Manages dual communication modes (IPC + stdin fallback)
- Implements initialization timeout protection (10s, L107-114)
- Provides heartbeat mechanism for IPC health monitoring (L86-102)

### Key Methods

**Core Lifecycle (L63-151)**
- `start()`: Initializes communication channels, sets up timeouts and heartbeat
- `stop()`: Graceful shutdown with resource cleanup
- `getWorkerState()`: Returns current proxy state
- `getWorker()`: Exposes worker for testing

**Message Processing (L170-207)**
- `createMessageProcessor()`: Creates default command handler using MessageParser
- Clears init timeout on first 'init' command (L178-183)
- Handles worker termination with optional dry-run delay (L196-205)

**Communication Setup (L212-294)**
- `setupIPCCommunication()`: Configures process IPC with message counting and heartbeat
- `setupStdinCommunication()`: Fallback readline interface
- Dual-channel architecture with IPC priority

**Error Handling (L299-346)**
- `setupGlobalErrorHandlers()`: Process-level exception/signal handlers
- Graceful SIGTERM/SIGINT handling with shutdown callbacks

### Execution Mode Detection

**Utility Functions (L352-372)**
- `detectExecutionMode()`: Detects direct execution, IPC availability, worker environment
- `shouldAutoExecute()`: Determines if auto-execution should occur

### Key Dependencies

- `DapProxyWorker`: Core worker implementation for command processing
- `MessageParser`: Command parsing from string messages  
- `DapProxyDependencies`: Injected dependencies including message sender
- `ILogger`: Logging abstraction

### Architectural Patterns

- **Dependency Injection**: Constructor receives all external dependencies
- **Dual Communication**: IPC primary, stdin fallback with automatic detection
- **Lifecycle Management**: Explicit start/stop with resource cleanup
- **Error Boundaries**: Process-level handlers with graceful shutdown
- **Heartbeat Protocol**: Regular IPC health checks with counters
- **Timeout Protection**: Prevents orphaned processes via init timeout