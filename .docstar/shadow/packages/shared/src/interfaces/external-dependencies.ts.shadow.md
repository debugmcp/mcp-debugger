# packages/shared/src/interfaces/external-dependencies.ts
@source-hash: 5241b15e4f115cc1
@generated: 2026-02-09T18:14:11Z

## Primary Purpose

This file defines abstraction interfaces for external dependencies used across the codebase, enabling dependency injection and facilitating testing through mocking without implementation changes.

## Key Interfaces & Their Roles

**Core System Dependencies:**
- `IFileSystem` (L22-41): Comprehensive file system abstraction mirroring fs-extra operations including basic fs methods (readFile, writeFile, exists, mkdir, etc.) and enhanced methods (ensureDir, pathExists, copy, outputFile)
- `IProcessManager` (L61-64): Process spawning and execution abstraction with spawn() and exec() methods
- `INetworkManager` (L70-73): Network operations including server creation and free port discovery
- `IEnvironment` (L108-112): Environment variable and working directory access abstraction

**Process & Server Management:**
- `IChildProcess` (L47-55): EventEmitter-based child process interface mirroring Node.js ChildProcess with pid, kill signals, and stdio streams
- `IServer` (L79-84): EventEmitter-based server interface mirroring Node.js net.Server with listen/close/address methods

**Utility Interfaces:**
- `ILogger` (L90-95): Standard logging interface with info/error/debug/warn methods accepting message and optional metadata
- `IProxyManager` (L13-16): Minimal proxy management interface with dispose() method (noted as remaining in core package)

**Factory Patterns:**
- `IProxyManagerFactory` (L100-102): Creates IProxyManager instances with optional IDebugAdapter
- `ILoggerFactory` (L134-136): Creates named loggers with configurable options
- `IChildProcessFactory` (L138-140): Creates IChildProcess instances

**Dependency Injection Container:**
- `IDependencies` (L117-123): Complete dependency set containing fileSystem, processManager, networkManager, logger, and environment
- `PartialDependencies` (L129): Type alias for partial dependency injection supporting gradual migration

## Dependencies

- Node.js built-in modules: `events.EventEmitter`, `child_process.SpawnOptions`, `fs.Stats`
- Internal: `IDebugAdapter` from debug-adapter.js (L10)

## Architectural Patterns

- **Interface Segregation**: Each interface focuses on specific functionality domain
- **Dependency Injection**: IDependencies provides container pattern for managing external dependencies
- **Factory Pattern**: Multiple factory interfaces enable flexible object creation
- **Gradual Migration**: PartialDependencies supports incremental adoption
- **Testing Facilitation**: All interfaces designed for easy mocking and testing