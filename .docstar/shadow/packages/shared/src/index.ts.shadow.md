# packages/shared/src/index.ts
@source-hash: aef323086034389d
@generated: 2026-02-10T00:41:31Z

## Purpose
Package index file exporting shared interfaces, types, and utilities for the MCP (Model Context Protocol) Debugger ecosystem. Serves as the central export hub enabling language-specific debug adapters to integrate with the main debugger through well-defined contracts.

## Architecture
Organized into logical sections with clear separation between types/interfaces and value exports:

### Core Debug Adapter Abstractions (L14-55)
- **IDebugAdapter** (L16): Main adapter interface for language-specific debuggers
- **ValidationResult, ValidationError, ValidationWarning** (L19-21): Input validation contracts
- **AdapterConfig, AdapterCommand, AdapterCapabilities** (L25-27): Adapter state and configuration
- **GenericLaunchConfig, LanguageSpecificLaunchConfig** (L30-31): Launch configuration types
- **AdapterState** (L47): Enum for adapter lifecycle states
- **DebugFeature** (L50): Enum defining available debug features
- **AdapterError, AdapterErrorCode** (L53-54): Error handling abstractions

### Adapter Registry System (L57-90)
- **IAdapterRegistry, IAdapterFactory** (L60-61): Registry pattern for managing debug adapters
- **AdapterMetadata, AdapterInfo** (L65-66): Adapter discovery and metadata
- **BaseAdapterFactory** (L80): Base implementation for adapter factories
- **Type guards** (L87-89): Runtime type checking utilities (isAdapterFactory, isAdapterRegistry)

### External Dependencies (L92-112)
Dependency injection contracts for:
- **IFileSystem, IChildProcess, IProcessManager** (L95-97): System resource abstractions
- **INetworkManager, IServer, ILogger** (L98-100): Network and logging services
- **IDependencies, PartialDependencies** (L106-107): DI container interfaces

### Process Management (L114-131)
- **IProcess, IProcessLauncher** (L117-118): Generic process abstractions
- **IDebugTargetLauncher, IDebugTarget** (L122-123): Debug session process management
- **IProxyProcessLauncher, IProxyProcess** (L126-127): Proxy-based debugging support

### Models and Session Management (L135-168)
- **CustomLaunchRequestArguments** (L138): Launch configuration customization
- **DebugSession, DebugSessionInfo** (L147-148): Session state management
- **Variable, StackFrame, DebugLocation** (L151-153): Debug information representations
- **DebugLanguage, SessionLifecycleState** (L159-160): Core enums for language and state
- **State mapping functions** (L166-167): Legacy compatibility helpers

### Factories and Policies (L170-188)
- **AdapterFactory** (L172): Main adapter factory implementation
- **Language-specific policies** (L182-187): Specialized behavior for JavaScript, Python, Java, Rust, Go, and Mock adapters
- **AdapterPolicy interface** (L176): Strategy pattern for adapter-specific behaviors

### System Integration (L190-203)
- **DapClientBehavior** (L192): DAP client behavior contracts
- **AdapterLaunchBarrier** (L199): Launch coordination primitives
- **FileSystem abstractions** (L202-203): Pluggable filesystem with Node.js default

### External Protocol Support (L205-206)
Re-exports VSCode Debug Protocol types for seamless integration with standard debug tooling.

## Key Patterns
- **Interface Segregation**: Clean separation between types and implementations
- **Dependency Injection**: Extensive use of interfaces for testability and modularity
- **Strategy Pattern**: Language-specific adapter policies for customized behavior
- **Factory Pattern**: Centralized adapter creation and registration
- **Registry Pattern**: Dynamic adapter discovery and management