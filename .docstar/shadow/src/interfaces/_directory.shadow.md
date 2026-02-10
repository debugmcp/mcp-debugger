# src/interfaces/
@generated: 2026-02-10T01:19:37Z

## Overall Purpose

The `src/interfaces` directory defines the core abstraction layer for the system, providing TypeScript interfaces that enable dependency injection, testability, and loose coupling throughout the application. This module serves as the contract definition layer, abstracting Node.js built-ins, external dependencies, and domain-specific operations to support clean architecture principles.

## Key Components and Relationships

### System Abstractions (`external-dependencies.ts`)
The foundation layer providing interfaces that mirror Node.js built-ins and third-party libraries:
- **Core System**: IFileSystem, IChildProcess, IProcessManager, INetworkManager, IServer
- **Application Services**: ILogger, IProxyManagerFactory, IEnvironment
- **Dependency Container**: IDependencies aggregates all interfaces for injection

### Process Management (`process-interfaces.ts`)
Domain-specific abstractions built on top of system interfaces:
- **IProcess**: High-level process wrapper extending EventEmitter
- **Specialized Launchers**: IDebugTargetLauncher, IProxyProcessLauncher for specific use cases
- **Factory Pattern**: IProcessLauncherFactory centralizes creation of all launcher types

### Command Resolution (`command-finder.ts`)
Utility interface for system command discovery:
- **CommandFinder**: Contract for resolving command names to executable paths
- **CommandNotFoundError**: Specialized error handling for resolution failures

## Public API Surface

### Main Entry Points
- **IDependencies**: Primary dependency injection container
- **IProcessLauncherFactory**: Central factory for all process operations
- **CommandFinder**: System command resolution interface

### Domain-Specific Interfaces
- **IDebugTarget / IDebugTargetLauncher**: Python debugging workflow
- **IProxyProcess / IProxyProcessLauncher**: Proxy process management
- **ILogger**: Application logging abstraction

## Internal Organization and Data Flow

### Layered Architecture
1. **System Layer**: External dependencies abstraction (Node.js, fs-extra, etc.)
2. **Domain Layer**: Process management and specialized operations
3. **Utility Layer**: Command resolution and error handling

### Dependency Flow
- `external-dependencies.ts` provides base abstractions
- `process-interfaces.ts` builds domain-specific interfaces on top of system abstractions
- `command-finder.ts` provides utility interfaces used by process management
- All interfaces designed for constructor injection via IDependencies

## Important Patterns and Conventions

### Design Patterns
- **Dependency Injection**: All interfaces designed for easy testing and mocking
- **Factory Pattern**: Centralized object creation with IProcessLauncherFactory
- **Interface Segregation**: Fine-grained interfaces matching specific responsibilities
- **Gradual Migration**: PartialDependencies supports incremental adoption

### Architectural Constraints
- All async operations return Promises for consistent async patterns
- Maintains API compatibility with Node.js built-ins where applicable
- EventEmitter extension pattern for stateful objects
- Readonly properties for immutable data (e.g., CommandNotFoundError.command)

### Testing Support
- Clean separation between interfaces and implementations
- Factory interfaces enable easy mock injection
- Specialized error classes for precise error testing
- PartialDependencies type allows selective mocking in tests