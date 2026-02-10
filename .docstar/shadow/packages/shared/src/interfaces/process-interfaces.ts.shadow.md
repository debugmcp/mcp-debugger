# packages/shared/src/interfaces/process-interfaces.ts
@source-hash: 154da350c07447ab
@generated: 2026-02-09T18:14:12Z

## Primary Purpose
TypeScript interface definitions for high-level process management abstractions. Provides domain-specific wrappers over Node.js child process operations to improve testability and simplify process lifecycle management.

## Core Interfaces

### IProcess (L12-25)
High-level abstraction over Node.js ChildProcess with cleaner API surface:
- **Properties**: `pid`, `stdin/stdout/stderr` streams, lifecycle state (`killed`, `exitCode`, `signalCode`)
- **Methods**: `send()` for IPC, `kill()` for termination
- **Extends**: EventEmitter for process event handling

### IProcessLauncher (L31-33)
General-purpose process spawning interface:
- **Method**: `launch(command, args, options)` returns IProcess instance
- Abstracts complexity of Node.js spawn/exec operations

### IProcessOptions (L39-45)
Simplified spawn configuration object:
- **Fields**: `cwd`, `env`, `shell`, `stdio`, `detached`
- Subset of Node.js SpawnOptions focused on common use cases
- **Note**: `stdio` uses `any` type for Node.js compatibility (L43)

## Specialized Launchers

### IDebugTargetLauncher (L51-58)
Python debugging process launcher:
- **Method**: `launchPythonDebugTarget()` returns Promise<IDebugTarget>
- Encapsulates debugpy integration complexity
- Parameters: script path, args, optional Python path and debug port

### IDebugTarget (L64-68)
Debug session container:
- **Properties**: `process` (IProcess), `debugPort` number
- **Method**: `terminate()` for cleanup
- Couples process lifecycle with debug connection management

### IProxyProcessLauncher (L74-80)
Proxy process spawning interface:
- **Method**: `launchProxy()` returns IProxyProcess
- Session-aware proxy management with environment variable support

### IProxyProcess (L86-90)
Enhanced process interface for proxy operations:
- **Extends**: IProcess with additional proxy-specific methods
- **Properties**: `sessionId` for session tracking
- **Methods**: `sendCommand()` for structured communication, `waitForInitialization()` with timeout

## Factory Pattern

### IProcessLauncherFactory (L96-100)
Dependency injection factory for launcher creation:
- **Methods**: Creates instances of all three launcher types
- Enables easy swapping between production and test implementations
- Supports polymorphic launcher instantiation

## Dependencies
- **EventEmitter**: From Node.js 'events' module (L6)
- **Node.js Types**: WritableStream, ReadableStream for stdio handling

## Architectural Patterns
- **Abstraction Layer**: Wraps Node.js child_process with domain-specific interfaces
- **Factory Pattern**: Centralized launcher creation for dependency injection
- **Composition**: IDebugTarget and IProxyProcess compose IProcess with specialized behavior
- **Async Operations**: Debug target launching returns Promise for async initialization