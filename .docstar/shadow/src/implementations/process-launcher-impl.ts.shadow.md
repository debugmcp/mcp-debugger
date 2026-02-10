# src/implementations/process-launcher-impl.ts
@source-hash: bc40915e7772577c
@generated: 2026-02-10T00:42:00Z

## Purpose

Production implementations of process launcher interfaces that delegate to existing ProcessManager for actual process operations. Provides adapters for wrapping child processes with cleaner interfaces and specialized functionality for debugging and proxy processes.

## Key Classes

### ProcessAdapter (L24-132)
- **Purpose**: Wraps IChildProcess as IProcess with EventEmitter interface
- **Key Features**:
  - Event forwarding from child process (exit, close, error, spawn, message)
  - Exit code and signal code tracking (L25-26, L99-105)
  - Enhanced kill method with process group handling for non-Windows/non-container environments (L111-131)
  - Automatic listener cleanup tracking (L27, L62-69)
  - Default error handler to prevent unhandled errors (L73-76)

### ProcessLauncherImpl (L137-144)
- **Purpose**: Basic process launcher implementation
- **Method**: `launch()` - spawns process via ProcessManager and wraps in ProcessAdapter

### DebugTargetLauncherImpl (L149-204)
- **Purpose**: Specialized launcher for Python debugging with debugpy
- **Key Method**: `launchPythonDebugTarget()` (L155-202)
  - Finds free port via NetworkManager if not specified
  - Launches Python with debugpy module and wait-for-client flag
  - Returns IDebugTarget with process, debug port, and terminate method
  - Terminate method includes 5-second timeout with SIGKILL fallback

### ProxyProcessAdapter (L210-579)
- **Purpose**: Enhanced process adapter for proxy processes with initialization tracking
- **Critical Features**:
  - **Initialization State Machine** (L214): 'none' | 'waiting' | 'completed' | 'failed'
  - **Promise-based initialization** (L295-350) with timeout and cleanup
  - **Message-based initialization detection** (L313-320): watches for 'adapter_configured_and_launched' or 'dry_run_complete'
  - **IPC command sending** (L470-537) with detailed event emission for debugging
  - **Resource cleanup and disposal** (L409-430) with listener removal
  - **Early exit handling** (L399-407) for processes that exit before initialization

### ProxyProcessLauncherImpl (L584-656)
- **Purpose**: Launches proxy worker processes with specific environment setup
- **Key Features**:
  - Filters test-related environment variables (L607-618)
  - Sets working directory to project root (L622)
  - Uses diagnostic flags (--trace-uncaught, --trace-exit)
  - Detailed environment logging for debugging (L625-634)
  - IPC stdio configuration with proper detached: false setting

### ProcessLauncherFactoryImpl (L661-680)
- **Purpose**: Factory for creating launcher instances
- **Methods**: Creates ProcessLauncher, DebugTargetLauncher, and ProxyProcessLauncher

## Dependencies

- EventEmitter from 'events'
- path, fileURLToPath for file system operations
- @debugmcp/shared interfaces for IProcess, IChildProcess, IProcessManager, INetworkManager

## Architecture Patterns

- **Adapter Pattern**: Wraps IChildProcess with enhanced IProcess interface
- **Factory Pattern**: ProcessLauncherFactoryImpl creates configured instances
- **State Machine**: ProxyProcessAdapter uses initialization states for lifecycle management
- **Resource Management**: Automatic listener cleanup and disposal patterns

## Critical Invariants

- All event listeners must be tracked and cleaned up to prevent memory leaks
- Proxy processes must complete initialization handshake before being considered ready
- Process killing attempts process group termination on Unix systems (except containers)
- IPC communication requires proper stdio configuration and working directory setup
- Environment variable filtering prevents test contamination in proxy processes