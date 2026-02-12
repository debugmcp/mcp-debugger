# src\interfaces/
@generated: 2026-02-12T21:05:42Z

## Purpose
The `interfaces` directory defines the core contracts and abstractions for the system's process management, external dependency injection, and command resolution capabilities. This module serves as the foundational layer for dependency injection patterns, enabling testability, modularity, and clean architecture separation throughout the application.

## Key Components and Architecture

### Core Abstraction Layers
The directory contains three primary interface categories:

**System Abstractions** (`external-dependencies.ts`):
- **IFileSystem**: Abstracts fs/fs-extra operations for file and directory management
- **IChildProcess, IProcessManager**: Low-level process spawning and management
- **INetworkManager, IServer**: Network operations and server lifecycle
- **ILogger**: Standardized logging interface
- **IEnvironment**: Environment variable and working directory access

**Process Management** (`process-interfaces.ts`):
- **IProcess**: High-level domain-focused process abstraction extending EventEmitter
- **IProcessLauncher**: General process spawning interface
- **IDebugTargetLauncher**: Python debugging specialist with debug port management
- **IProxyProcessLauncher**: Proxy process management with session tracking

**Command Resolution** (`command-finder.ts`):
- **CommandFinder**: Contract for resolving command names to executable paths
- **CommandNotFoundError**: Specialized error handling for command resolution failures

### Data Flow and Component Relationships
The interfaces work together in a layered architecture:

1. **External Dependencies** provide the foundational system abstractions
2. **Process Interfaces** build upon these to provide domain-specific process management
3. **Command Finder** enables discovery of executable commands in the system PATH
4. **Factory Patterns** throughout enable dependency injection and testing

### Public API Surface
**Primary Entry Points**:
- `IDependencies` - Complete dependency injection container
- `IProcessLauncherFactory` - Central factory for all process launcher types
- `CommandFinder` - Command resolution interface
- `IDebugTargetLauncher` - Python debug session management
- `IProxyProcessLauncher` - Proxy process operations

**Key Factory Interfaces**:
- `ILoggerFactory`, `IChildProcessFactory` for instance creation
- `IProxyManagerFactory` for proxy management
- `PartialDependencies` for gradual migration support

### Internal Organization
The module follows interface segregation principles with fine-grained contracts matching specific responsibilities. Each interface maintains compatibility with corresponding Node.js built-ins while adding domain-specific enhancements. The design supports both synchronous and asynchronous operations where appropriate.

### Important Patterns and Conventions
- **Dependency Injection**: All interfaces designed for constructor injection
- **Factory Pattern**: Centralized object creation with easy test substitution
- **Promise-based APIs**: Consistent async patterns throughout
- **EventEmitter Extension**: Stateful objects extend Node.js EventEmitter
- **Gradual Migration Support**: PartialDependencies type enables incremental adoption
- **Error Handling**: Specialized error classes (CommandNotFoundError) for domain-specific failures

The interfaces directory serves as the contract layer enabling the entire system's testability and modularity while maintaining clean separation between infrastructure concerns and business logic.