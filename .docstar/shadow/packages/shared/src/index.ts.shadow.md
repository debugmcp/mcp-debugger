# packages/shared/src/index.ts
@source-hash: e05c71a6de2d922b
@generated: 2026-02-11T16:12:53Z

## Primary Purpose
Central entry point for the MCP Debugger shared package, providing type-safe exports of core abstractions, interfaces, and utilities used across the debug adapter ecosystem.

## Key Exports and Responsibilities

### Core Debug Adapter Interface (L14-55)
- **IDebugAdapter**: Main adapter interface with validation, configuration, and capabilities
- **AdapterState, AdapterError, AdapterErrorCode**: Runtime state management and error handling
- **ValidationResult, AdapterConfig, AdapterCapabilities**: Configuration validation and feature detection
- **GenericLaunchConfig, LanguageSpecificLaunchConfig**: Launch configuration abstractions

### Adapter Registry System (L57-90)
- **IAdapterRegistry, IAdapterFactory**: Registry pattern for managing debug adapters
- **BaseAdapterFactory**: Base implementation for adapter factories
- **AdapterMetadata, AdapterInfo**: Runtime adapter discovery and metadata
- **Type guards**: `isAdapterFactory`, `isAdapterRegistry` for runtime validation

### External Dependencies (L92-112)
- **Dependency Injection**: `IDependencies, PartialDependencies` for service composition
- **System Abstractions**: `IFileSystem, IChildProcess, IProcessManager, INetworkManager`
- **Infrastructure**: `IServer, ILogger, IProxyManager` for runtime services

### Process Management (L114-131)
- **IProcess, IProcessLauncher**: Generic process lifecycle management
- **IDebugTarget, IDebugTargetLauncher**: Debug-specific process coordination
- **IProxyProcess**: Proxy-mediated process communication

### Data Models (L135-168)
- **Session Management**: `DebugSession, SessionConfig, DebugSessionInfo`
- **Debug State**: `Breakpoint, Variable, StackFrame, DebugLocation`
- **Language Support**: `DebugLanguage` enum with state mapping functions
- **Lifecycle States**: `SessionLifecycleState, ExecutionState, SessionState`

### Language-Specific Policies (L174-187)
- **AdapterPolicy**: Base policy interface for language-specific behavior
- **Language Implementations**: `JsDebugAdapterPolicy, PythonAdapterPolicy, RustAdapterPolicy, GoAdapterPolicy`
- **DefaultAdapterPolicy, MockAdapterPolicy**: Standard and testing implementations

### Client Behavior Abstractions (L189-195)
- **DapClientBehavior**: DAP client interaction patterns
- **ReverseRequestResult, ChildSessionConfig**: Client-server communication coordination

### Utility Services (L197-202)
- **AdapterLaunchBarrier**: Coordination helper for adapter startup
- **FileSystem**: Abstraction with NodeJS implementation and global defaults

### External Integration (L204-205)
- **VSCode Debug Protocol**: Re-exports `@vscode/debugprotocol` types for convenience

## Architectural Patterns
- **Facade Pattern**: Single entry point consolidating multiple interface modules
- **Dependency Injection**: Comprehensive abstraction layer for external dependencies
- **Factory Pattern**: Adapter creation and registry management
- **Policy Pattern**: Language-specific behavior customization
- **Type Safety**: Extensive use of TypeScript interfaces and type guards

## Critical Dependencies
- `@vscode/debugprotocol`: VSCode Debug Adapter Protocol types
- Internal modules: Multiple interface and model files providing implementation details

## Integration Points
This package serves as the contract layer between the core debugger and language-specific adapters, enabling pluggable debug adapter architectures while maintaining type safety and consistent interfaces.