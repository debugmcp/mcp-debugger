# src/interfaces/
@generated: 2026-02-11T23:47:36Z

## Purpose
The interfaces directory defines TypeScript contracts and abstractions that enable dependency injection, testability, and loose coupling throughout the application. It provides comprehensive interface definitions for external dependencies, process management, and system command operations.

## Key Components and Architecture

### Dependency Injection Foundation
- **external-dependencies.ts**: Core dependency injection interfaces abstracting Node.js built-ins (filesystem, child processes, networking) and application services (logging, environment, proxy management)
- **IDependencies**: Central container aggregating all external dependencies for constructor injection
- **PartialDependencies**: Type alias supporting gradual migration and optional dependency patterns
- **Factory interfaces**: ILoggerFactory, IChildProcessFactory, IProxyManagerFactory for complex object creation

### Process Management Abstractions
- **process-interfaces.ts**: High-level process management interfaces built on top of Node.js child_process
- **IProcess**: Domain-focused abstraction over ChildProcess with simplified API
- **Specialized launchers**: IDebugTargetLauncher for Python debugging, IProxyProcessLauncher for proxy operations
- **IProcessLauncherFactory**: Central factory for all process launcher types

### System Command Resolution
- **command-finder.ts**: Interface for finding executable commands in system PATH
- **CommandFinder**: Contract for command resolution with async PATH lookup
- **CommandNotFoundError**: Specialized error handling for command resolution failures

## Public API Surface

### Main Entry Points
- **IDependencies**: Primary dependency container interface for application-wide injection
- **IProcessLauncherFactory**: Central factory for all process management operations
- **CommandFinder**: Interface for system command resolution
- **IFileSystem, ILogger, IEnvironment**: Core service abstractions

### Specialized Process Management
- **IDebugTargetLauncher**: Python debug session management
- **IProxyProcessLauncher**: Proxy process lifecycle management
- **IProcessLauncher**: General-purpose process spawning

## Internal Organization

### Layered Abstraction Strategy
1. **System Layer**: Abstracts Node.js built-ins (fs, child_process, net) via external-dependencies.ts
2. **Domain Layer**: Provides domain-specific process management via process-interfaces.ts
3. **Utility Layer**: System command utilities via command-finder.ts

### Design Patterns
- **Interface Segregation**: Fine-grained interfaces matching specific responsibilities
- **Factory Pattern**: Centralized object creation for complex dependencies
- **Dependency Injection**: All interfaces designed for constructor injection and easy testing
- **Composition**: Complex objects (IDebugTarget) wrap simpler ones (IProcess) rather than inheriting

## Key Conventions
- All async operations return Promises for consistent async patterns
- EventEmitter extension pattern for stateful objects requiring event handling
- Readonly properties for immutable data (command names, session IDs)
- Optional parameters support gradual adoption and backward compatibility
- Error types extend built-in Error class with domain-specific properties

This interfaces module serves as the foundation for testable, loosely-coupled architecture by providing comprehensive abstractions over external dependencies and domain-specific operations.