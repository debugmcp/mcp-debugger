# src/interfaces/external-dependencies.ts
@source-hash: e904edcd18ba7261
@generated: 2026-02-10T00:41:51Z

## Purpose
Defines external dependency interfaces for dependency injection and testing. Enables easy mocking and testing without changing implementation by abstracting Node.js built-in modules and third-party dependencies.

## Key Interfaces

### Core System Abstractions
- **IFileSystem (L17-36)**: Mirrors fs-extra functionality with async file operations, directory management, and path utilities. Combines standard fs methods with fs-extra extensions.
- **IChildProcess (L42-50)**: Extends EventEmitter to mirror Node.js ChildProcess with process control, IPC, and stream access.
- **IProcessManager (L56-59)**: High-level process spawning interface providing spawn() and exec() methods.
- **INetworkManager (L65-68)**: Network utilities for server creation and port discovery.
- **IServer (L74-79)**: Mirrors Node.js net.Server with listen/close lifecycle and address management.

### Application Services
- **ILogger (L85-90)**: Standard logging interface with info/error/debug/warn methods supporting optional metadata.
- **IProxyManagerFactory (L95-97)**: Factory for creating IProxyManager instances with optional debug adapter.
- **IEnvironment (L103-107)**: Environment variable access and working directory abstraction.

### Dependency Injection Support
- **IDependencies (L112-118)**: Complete dependency container aggregating all core interfaces.
- **PartialDependencies (L124)**: Type alias for gradual migration allowing optional dependencies.
- **Factory Interfaces (L129-135)**: ILoggerFactory and IChildProcessFactory for creating specific instances.

## Dependencies
- **Internal**: IProxyManager from proxy-manager, IDebugAdapter from @debugmcp/shared
- **Node.js Built-ins**: EventEmitter, SpawnOptions, fs.Stats

## Architectural Patterns
- **Dependency Injection**: Interfaces designed for constructor injection and testing
- **Factory Pattern**: Separate factory interfaces for complex object creation
- **Gradual Migration**: PartialDependencies type supports incremental adoption
- **Interface Segregation**: Fine-grained interfaces matching specific Node.js modules

## Design Constraints
- All async operations return Promises
- Maintains compatibility with Node.js built-in APIs
- Supports both sync and async variants where Node.js provides both
- EventEmitter extension pattern for stateful objects