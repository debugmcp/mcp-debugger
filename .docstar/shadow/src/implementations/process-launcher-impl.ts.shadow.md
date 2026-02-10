# src/implementations/process-launcher-impl.ts
@source-hash: bc40915e7772577c
@generated: 2026-02-09T18:15:12Z

## Purpose
Production implementations of process launcher interfaces that wrap the existing ProcessManager with additional abstraction layers for different process types.

## Key Classes and Functions

### ProcessAdapter (L24-132)
Core adapter class that wraps `IChildProcess` as `IProcess`, providing event forwarding and enhanced kill functionality.
- Constructor (L29-77): Sets up event handlers (exit, close, error, spawn, message) and tracks listeners for cleanup
- Properties (L79-105): Delegates to underlying childProcess (pid, stdin, stdout, stderr, killed, exitCode, signalCode)
- `kill()` (L111-131): Enhanced killing with process group support on Unix (but not in containers), with fallback mechanisms

### ProcessLauncherImpl (L137-144)
Simple launcher implementation that delegates to ProcessManager.
- `launch()` (L140-143): Creates ProcessAdapter around ProcessManager.spawn() result

### DebugTargetLauncherImpl (L149-204)
Specialized launcher for Python debug targets using debugpy.
- Constructor (L150-153): Requires processLauncher and networkManager
- `launchPythonDebugTarget()` (L155-202): Sets up debugpy with port allocation, wait-for-client mode, and graceful termination with timeout

### ProxyProcessAdapter (L210-579)
Complex adapter for proxy processes with initialization tracking and IPC command support.
- Constructor (L222-279): Similar event setup to ProcessAdapter but with initialization state tracking
- Initialization Management (L295-430): Promise-based initialization with timeout, completion detection via status messages, and comprehensive cleanup
- `waitForInitialization()` (L539-561): Creates initialization promise on first call, handles concurrent calls
- `sendCommand()` (L470-537): Enhanced IPC sending with detailed debugging events and error handling
- Disposal (L409-430): Comprehensive cleanup of listeners and initialization promises

### ProxyProcessLauncherImpl (L584-656)
Factory for creating proxy processes with specific environment and working directory setup.
- `launchProxy()` (L590-654): Creates Node.js child processes with diagnostic flags, filtered environment (removes test vars), and project root working directory

### ProcessLauncherFactoryImpl (L661-680)
Main factory class providing all launcher types.
- Creates ProcessLauncher, DebugTargetLauncher, and ProxyProcessLauncher instances

## Dependencies
- @debugmcp/shared: All interface definitions (IProcess, IProcessLauncher, etc.)
- Node.js built-ins: events, path, url
- ProcessManager and NetworkManager for actual process operations

## Architecture Patterns
- **Adapter Pattern**: ProcessAdapter and ProxyProcessAdapter wrap IChildProcess with enhanced interfaces
- **Factory Pattern**: ProcessLauncherFactoryImpl creates configured launcher instances
- **Event-driven**: Extensive use of EventEmitter for process lifecycle management
- **Promise-based Initialization**: ProxyProcessAdapter uses promises for asynchronous initialization tracking

## Critical Implementation Details
- **Event Listener Tracking**: Both adapters track listeners for proper cleanup (L27, L218)
- **Container Detection**: Process killing behavior changes in containers (L114)
- **Environment Filtering**: Test-related env vars are filtered out for proxy processes (L604-618)
- **Working Directory**: Proxy processes use project root, not current directory (L622)
- **IPC Debugging**: Extensive debugging events for IPC operations (L483-536)
- **Initialization State Machine**: ProxyProcessAdapter tracks initialization through states: none → waiting → completed/failed (L214)