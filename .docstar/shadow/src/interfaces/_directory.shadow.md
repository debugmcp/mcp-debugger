# src\interfaces/
@generated: 2026-02-12T21:00:54Z

## Purpose
The interfaces directory defines the core abstraction layer for the application, providing TypeScript contracts for system operations, dependency injection, and process management. This module serves as the foundation for testability and modularity by abstracting external dependencies and establishing clear API boundaries.

## Key Components and Organization

### System Abstractions (`external-dependencies.ts`)
The primary dependency injection hub containing comprehensive interfaces for:
- **Core System Operations**: File system (IFileSystem), process management (IProcessManager), networking (INetworkManager)
- **Application Services**: Logging (ILogger), environment access (IEnvironment) 
- **Factory Patterns**: Component creation interfaces (ILoggerFactory, IChildProcessFactory)
- **Complete DI Container**: IDependencies aggregates all interfaces for constructor injection

### Process Management (`process-interfaces.ts`) 
Specialized abstractions for application-specific process operations:
- **General Process Control**: IProcess, IProcessLauncher for basic child process operations
- **Debug Target Management**: IDebugTargetLauncher, IDebugTarget for Python debugging scenarios
- **Proxy Process Handling**: IProxyProcessLauncher, IProxyProcess for proxy session management
- **Centralized Factory**: IProcessLauncherFactory creates all launcher types

### Command Resolution (`command-finder.ts`)
Simple but critical interface for system command discovery:
- **CommandFinder Interface**: Async command path resolution
- **CommandNotFoundError**: Specialized error handling for missing commands

## Public API Surface
The module provides three main entry points:

1. **Dependency Injection** (`IDependencies`, `PartialDependencies`)
   - Complete application dependency container
   - Gradual migration support through optional dependencies

2. **Process Management Factory** (`IProcessLauncherFactory`) 
   - Creates specialized launchers for different process types
   - Central point for all process-related operations

3. **Command Resolution** (`CommandFinder`)
   - System PATH command discovery
   - Foundation for executable location

## Internal Organization and Data Flow
The interfaces follow a layered architecture:
- **Foundation Layer**: Command resolution and basic system abstractions
- **Service Layer**: Application-specific services (logging, environment)  
- **Domain Layer**: Specialized process management for debugging and proxy operations
- **Integration Layer**: Dependency injection containers tying everything together

## Key Design Patterns
- **Dependency Injection**: All interfaces designed for constructor injection and easy testing
- **Factory Pattern**: Centralized creation of complex objects through dedicated factories
- **Interface Segregation**: Fine-grained interfaces matching specific responsibilities
- **Async-First**: All I/O operations return Promises for non-blocking execution
- **EventEmitter Extension**: Process-related interfaces extend EventEmitter for reactive patterns

## Testing and Modularity Benefits
This abstraction layer enables:
- Easy mocking of external dependencies for unit tests
- Gradual migration through PartialDependencies type
- Clear separation of concerns between business logic and infrastructure
- Consistent error handling patterns across the application
- Platform-agnostic design despite wrapping Node.js APIs