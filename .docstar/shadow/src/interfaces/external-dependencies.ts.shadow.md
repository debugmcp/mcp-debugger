# src/interfaces/external-dependencies.ts
@source-hash: e904edcd18ba7261
@generated: 2026-02-09T18:15:05Z

## Purpose
Defines TypeScript interfaces for external dependencies to enable dependency injection and testing isolation. This abstraction layer allows mocking of system dependencies (filesystem, processes, network) without changing implementation code.

## Core Interfaces

**IFileSystem (L17-36)**: Comprehensive filesystem abstraction combining Node.js `fs` and `fs-extra` operations. Includes basic operations (`readFile`, `writeFile`, `exists`, `mkdir`) and enhanced utilities (`ensureDir`, `pathExists`, `remove`, `copy`). All operations are Promise-based except sync variants (`ensureDirSync`, `existsSync`).

**IChildProcess (L42-50)**: Process handle interface extending EventEmitter with lifecycle management (`kill`, `send`) and stream access (`stdin`, `stdout`, `stderr`). Mirrors Node.js ChildProcess API.

**IProcessManager (L56-59)**: Process spawning and execution interface. Provides `spawn()` for long-running processes and `exec()` for command execution with output capture.

**INetworkManager (L65-68)**: Network operations abstraction for server creation and port discovery. Critical for dynamic port allocation in testing environments.

**IServer (L74-79)**: Network server interface mirroring Node.js `net.Server` with lifecycle methods (`listen`, `close`) and introspection (`address`).

**ILogger (L85-90)**: Standard logging interface with four levels (info, error, debug, warn) and optional metadata support.

## Dependency Injection Architecture

**IDependencies (L112-118)**: Main dependency container aggregating all core dependencies. Used by components requiring full system access.

**PartialDependencies (L124)**: Flexible type allowing components to specify subset of dependencies for gradual migration and focused testing.

## Factory Interfaces

**IProxyManagerFactory (L95-97)**: Creates proxy managers with optional debug adapter integration.

**ILoggerFactory (L129-131)**: Creates named loggers with configuration options.

**IChildProcessFactory (L133-135)**: Creates child process instances for testing scenarios.

**IEnvironment (L103-107)**: Environment variable and working directory abstraction with getter methods and full environment access.

## Key Dependencies
- Node.js built-ins: `events.EventEmitter`, `child_process.SpawnOptions`, `fs.Stats`
- Internal types: `IProxyManager`, `IDebugAdapter`

## Architectural Patterns
- Interface segregation: Each interface focuses on single responsibility
- Factory pattern: Separate creation interfaces for complex objects
- Gradual migration support: Partial dependencies enable incremental adoption
- Testing-first design: All interfaces designed for easy mocking