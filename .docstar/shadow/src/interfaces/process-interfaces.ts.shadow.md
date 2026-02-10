# src/interfaces/process-interfaces.ts
@source-hash: 154da350c07447ab
@generated: 2026-02-09T18:15:04Z

## Process Management Interface Definitions

This file defines high-level interfaces for process management, providing domain-specific abstractions over Node.js process operations for better testability and cleaner APIs.

### Core Interfaces

**IProcess (L12-25)** - Primary process abstraction extending EventEmitter
- Wraps Node.js ChildProcess with cleaner API surface
- Properties: `pid`, stdio streams (`stdin`, `stdout`, `stderr`), lifecycle state (`killed`, `exitCode`, `signalCode`)
- Methods: `send()` for IPC communication, `kill()` for termination
- Focuses on essential process control rather than exposing full ChildProcess complexity

**IProcessLauncher (L31-33)** - General-purpose process factory
- Single method `launch()` accepting command, args, and options
- Returns IProcess instances for spawned processes

**IProcessOptions (L39-45)** - Simplified spawn configuration
- Subset of Node.js SpawnOptions focusing on common use cases
- Properties: `cwd`, `env`, `shell`, `stdio`, `detached`
- Uses `any` type for stdio compatibility with Node.js StdioOptions

### Specialized Launchers

**IDebugTargetLauncher (L51-58)** - Python debugging process launcher
- `launchPythonDebugTarget()` method encapsulates debugpy setup complexity
- Returns Promise<IDebugTarget> with process and debug connection details

**IDebugTarget (L64-68)** - Debug process wrapper
- Combines IProcess with debug-specific properties (`debugPort`)
- Provides unified `terminate()` method for cleanup

**IProxyProcessLauncher (L74-80)** - Proxy process factory
- `launchProxy()` method for session-aware proxy processes
- Handles proxy script launching with session context

**IProxyProcess (L86-90)** - Enhanced process for proxy operations
- Extends IProcess with session management (`sessionId`)
- Adds `sendCommand()` for structured communication and `waitForInitialization()` for startup synchronization

### Factory Pattern

**IProcessLauncherFactory (L96-100)** - Central factory interface
- Creates instances of all launcher types
- Enables dependency injection and easy swapping between production/test implementations
- Methods: `createProcessLauncher()`, `createDebugTargetLauncher()`, `createProxyProcessLauncher()`

### Architecture Notes

- Uses composition over inheritance with EventEmitter extension
- Provides abstraction layer over Node.js process APIs for domain-specific use cases
- Designed for dependency injection and testability
- Separates general process management from specialized debugging/proxy concerns