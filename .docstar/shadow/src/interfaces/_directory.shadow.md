# src\interfaces/
@children-hash: 1227cf10bd95fed5
@generated: 2026-02-15T09:01:27Z

## Overall Purpose and Responsibility

The `interfaces` directory defines the core abstraction layer for the system, providing TypeScript contracts for dependency injection, testability, and system integration. It establishes clean boundaries between business logic and external dependencies while enabling easy mocking and testing of system operations.

## Key Components and Relationships

### System Command Resolution
- **CommandFinder**: Interface for resolving executable commands in system PATH
- **CommandNotFoundError**: Specialized error handling for command resolution failures
- Forms the foundation for discovering and validating external tools/executables

### External Dependencies Abstraction
- **Core System Interfaces**: IFileSystem, IChildProcess, IProcessManager abstract Node.js built-ins
- **Network Interfaces**: INetworkManager, IServer for network operations
- **Application Services**: ILogger, IEnvironment, IProxyManagerFactory for cross-cutting concerns
- **Dependency Container**: IDependencies aggregates all interfaces for injection; PartialDependencies supports gradual adoption

### Process Management Hierarchy  
- **IProcess**: High-level abstraction over Node.js ChildProcess with domain focus
- **IProcessLauncher**: General process spawning interface
- **Specialized Launchers**: 
  - IDebugTargetLauncher for Python debugging workflows
  - IProxyProcessLauncher for proxy process management
- **Enhanced Process Types**: IDebugTarget and IProxyProcess extend base functionality
- **Factory Pattern**: IProcessLauncherFactory centralizes creation of all launcher types

## Public API Surface

### Main Entry Points
1. **IDependencies**: Primary dependency injection container
2. **IProcessLauncherFactory**: Central factory for all process operations
3. **CommandFinder**: System command resolution
4. **ILogger**: Application logging interface

### Key Contracts
- **System Integration**: IFileSystem, IProcessManager, INetworkManager
- **Process Operations**: IProcessLauncher hierarchy with specialized variants
- **Error Handling**: CommandNotFoundError and standard Promise rejection patterns

## Internal Organization and Data Flow

### Dependency Flow
1. IDependencies container aggregates all system abstractions
2. Factory interfaces (ILoggerFactory, IChildProcessFactory) create specialized instances
3. Process launchers use system abstractions to spawn and manage processes
4. Command finder resolves executables before process creation

### Specialization Pattern
- Base interfaces (IProcess, IProcessLauncher) provide common functionality
- Specialized interfaces (IDebugTarget, IProxyProcess) extend for specific use cases
- Factory pattern centralizes creation while maintaining interface segregation

## Important Patterns and Conventions

### Design Patterns
- **Dependency Injection**: All interfaces designed for constructor injection
- **Factory Pattern**: Separate factory interfaces for complex object creation
- **Interface Segregation**: Fine-grained interfaces matching specific responsibilities
- **Composition over Inheritance**: Enhanced types wrap base interfaces rather than extending

### API Conventions
- **Async-First**: All I/O operations return Promises
- **Node.js Compatibility**: Interfaces mirror Node.js built-in APIs
- **EventEmitter Extension**: Stateful objects extend EventEmitter pattern
- **Readonly Properties**: Immutable data uses readonly pattern (e.g., CommandNotFoundError.command)

### Testing Support
- **Mock-Friendly**: All external dependencies abstracted behind interfaces
- **Gradual Migration**: PartialDependencies allows incremental adoption
- **Error Boundaries**: Specialized error types for better test assertions

The directory serves as the system's contract definition layer, enabling loose coupling, testability, and clean separation between business logic and system dependencies.