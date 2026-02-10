# src/interfaces/
@generated: 2026-02-10T21:26:21Z

## Purpose
The `src/interfaces` directory provides a comprehensive set of TypeScript interfaces that define contracts for system-level operations, dependency injection, and process management. This module serves as the foundational abstraction layer for the entire application, enabling testability, modularity, and clean architecture through interface-based design.

## Key Components and Relationships

### System Abstraction Layer
- **command-finder.ts**: Provides `CommandFinder` interface for system command resolution with specialized `CommandNotFoundError` handling
- **external-dependencies.ts**: Comprehensive abstractions over Node.js built-ins (filesystem, child processes, networking) and application services (logging, environment)

### Process Management Hierarchy
- **process-interfaces.ts**: Specialized process abstractions building on the foundation from external-dependencies
  - `IProcess`: Domain-focused child process wrapper
  - `IDebugTargetLauncher`/`IDebugTarget`: Python debugging specialists
  - `IProxyProcessLauncher`/`IProxyProcess`: Proxy process management
  - `IProcessLauncherFactory`: Centralized creation factory

## Public API Surface

### Core Entry Points
- **IDependencies**: Primary dependency injection container aggregating all system abstractions
- **IProcessLauncherFactory**: Main factory for creating process launchers
- **CommandFinder**: System command resolution interface
- **ILogger**: Standard logging contract

### Specialized Interfaces
- **IDebugTargetLauncher**: For Python debugging workflows
- **IProxyProcessLauncher**: For proxy process management
- **IFileSystem**, **IProcessManager**, **INetworkManager**: System operation abstractions

## Internal Organization and Data Flow

### Dependency Injection Pattern
1. **Base Layer**: System abstractions (filesystem, processes, networking) in `external-dependencies.ts`
2. **Domain Layer**: Specialized process interfaces in `process-interfaces.ts` building on base abstractions
3. **Utility Layer**: Command resolution in `command-finder.ts`
4. **Integration Layer**: `IDependencies` container unifying all interfaces

### Factory Pattern Implementation
- Separate factory interfaces enable complex object creation while maintaining testability
- `IProcessLauncherFactory` creates specialized launchers that return domain-specific process wrappers
- Factory methods abstract away implementation details from consumers

## Important Patterns and Conventions

### Interface Design Principles
- **Interface Segregation**: Fine-grained interfaces matching specific responsibilities
- **Dependency Inversion**: All dependencies accessed through interfaces, not concrete implementations
- **Async-First**: All I/O operations return Promises for consistent async handling
- **EventEmitter Extension**: Stateful objects extend EventEmitter for event-driven architecture

### Testing and Mocking Support
- **PartialDependencies**: Supports gradual migration and selective mocking
- **Interface-based**: All system dependencies mockable through interface substitution
- **Factory Abstraction**: Easy test double injection through factory interfaces

### Error Handling
- Specialized error classes (`CommandNotFoundError`) with proper inheritance and metadata
- Consistent error propagation through Promise rejection patterns

This interfaces directory serves as the architectural backbone, defining contracts that enable loose coupling, testability, and clean separation of concerns throughout the application.