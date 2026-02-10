# packages/shared/src/interfaces/external-dependencies.ts
@source-hash: 5241b15e4f115cc1
@generated: 2026-02-10T00:41:12Z

## External Dependencies Interfaces

**Purpose:** Defines type-safe dependency injection interfaces that mirror external Node.js dependencies for testing and mocking. Enables decoupling from concrete implementations across the shared package.

### Core Infrastructure Interfaces

**IProxyManager (L13-16):** Minimal proxy management interface with disposal pattern. Note indicates this remains in core package, not shared.

**IFileSystem (L22-41):** Comprehensive file system abstraction covering:
- Basic fs operations (readFile, writeFile, exists, mkdir, readdir, stat, unlink, rmdir)
- fs-extra enhanced methods (ensureDir, pathExists, remove, copy, outputFile)
- Mixed sync/async operations for flexibility

**IChildProcess (L47-55):** Node.js ChildProcess mirror extending EventEmitter with:
- Process lifecycle management (pid, killed, kill, send)
- Standard stream access (stdin, stdout, stderr)

### System Management Interfaces

**IProcessManager (L61-64):** Process spawning and execution abstraction:
- spawn() for long-running processes with options
- exec() for simple command execution with output capture

**INetworkManager (L70-73):** Network operations interface:
- Server creation abstraction
- Free port discovery utility

**IServer (L79-84):** Node.js net.Server mirror with standard TCP server operations (listen, close, address, unref)

### Utility Interfaces

**ILogger (L90-95):** Standard logging facade with four levels (info, error, debug, warn) and optional metadata support.

**IEnvironment (L108-112):** Environment abstraction providing:
- Individual variable access
- Complete environment snapshot
- Working directory access

### Dependency Injection Architecture

**IDependencies (L117-123):** Complete dependency container with all core services (fileSystem, processManager, networkManager, logger, environment).

**PartialDependencies (L129):** Type alias enabling gradual migration by allowing partial dependency specification.

### Factory Patterns

**IProxyManagerFactory (L100-102):** Creates proxy managers with optional debug adapter injection.

**ILoggerFactory (L134-136):** Named logger creation with configurable options.

**IChildProcessFactory (L138-140):** Child process instance factory.

### Key Dependencies
- Node.js built-ins: events.EventEmitter, child_process.SpawnOptions, fs.Stats
- Internal: debug-adapter interface

### Architectural Notes
- Follows dependency injection pattern for testability
- Interfaces mirror Node.js APIs for easy implementation swapping
- Mixed sync/async patterns to accommodate existing codebases
- Factory patterns for configurable object creation