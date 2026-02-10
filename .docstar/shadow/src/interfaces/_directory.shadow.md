# src/interfaces/
@generated: 2026-02-09T18:16:10Z

## Overall Purpose

The `interfaces` directory provides a comprehensive abstraction layer defining contracts for system-level operations and external dependencies. It serves as the architectural foundation for dependency injection, testing isolation, and platform abstraction throughout the application.

## Key Components and Organization

### System Abstraction Layer
- **external-dependencies.ts**: Core system abstractions (filesystem, networking, logging, environment)
- **IDependencies**: Central dependency container aggregating all system services
- **PartialDependencies**: Flexible typing for gradual dependency adoption

### Process Management
- **process-interfaces.ts**: High-level process lifecycle and communication abstractions
- **IProcess**: Clean wrapper around Node.js ChildProcess with essential operations
- **Specialized launchers**: Domain-specific process creation (debug targets, proxy processes)

### Command Resolution
- **command-finder.ts**: System PATH command discovery with structured error handling
- **CommandFinder**: Async interface for executable resolution
- **CommandNotFoundError**: Semantic error type for command failures

## Architectural Patterns

### Dependency Injection Architecture
The directory implements a comprehensive DI system where:
- All external dependencies are abstracted through interfaces
- Factory patterns enable object creation control
- Partial dependencies support incremental migration
- Testing isolation achieved through mockable contracts

### Interface Segregation
Each interface focuses on single responsibilities:
- **IFileSystem**: File operations only
- **IProcessManager**: Process spawning only  
- **ILogger**: Logging operations only
- **CommandFinder**: Command resolution only

### Factory Pattern
Centralized creation interfaces enable controlled object instantiation:
- **IProcessLauncherFactory**: Creates all process launcher variants
- **IProxyManagerFactory**: Manages proxy creation
- **ILoggerFactory**: Handles logger instantiation

## Public API Surface

### Primary Entry Points
- **IDependencies**: Main dependency container for full system access
- **IProcessLauncherFactory**: Central factory for process management
- **CommandFinder**: Command resolution service
- **ILogger/ILoggerFactory**: Logging infrastructure

### Core Abstractions
- **IFileSystem**: Complete filesystem operations
- **IProcess**: Process lifecycle management
- **INetworkManager**: Network server operations
- **IEnvironment**: Environment variable access

## Data Flow and Integration

1. **System Services**: External dependencies provide foundational system access
2. **Process Layer**: Higher-level process abstractions build on system services
3. **Command Resolution**: Command finder integrates with process management for executable discovery
4. **Factory Layer**: Factories coordinate component creation using system dependencies

## Internal Organization

The interfaces are organized by abstraction level:
- **Low-level**: Direct system service wrappers (filesystem, network, logging)
- **Mid-level**: Process management and command resolution
- **High-level**: Factory interfaces and dependency containers

## Testing and Development Patterns

- All interfaces designed for easy mocking in unit tests
- Promise-based APIs for async operations
- Custom error types provide semantic failure handling
- Gradual migration support through partial dependency injection
- Clean separation between production and test implementations

This directory establishes the contract layer enabling the entire application to be loosely coupled, testable, and platform-agnostic while maintaining clean architectural boundaries.