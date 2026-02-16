# packages\shared\src\interfaces/
@children-hash: 36be6cf3299b18ab
@generated: 2026-02-16T08:24:41Z

## Purpose

The `interfaces` directory defines the core abstraction layer for a multi-language debug adapter system built on the Debug Adapter Protocol (DAP). This module provides type-safe contracts and interfaces that enable pluggable language-specific debugging behaviors while maintaining a unified debugging experience across JavaScript, Python, Go, Rust, and other languages.

## Architecture Overview

The directory implements a **policy-driven architecture** where language-specific debugging behaviors are encapsulated in adapter policies that implement common interfaces. This enables the core DAP transport layer to remain generic while accommodating language-specific quirks like multi-session debugging, initialization sequences, and variable filtering.

### Core Components

**Debug Adapter Interface** (`debug-adapter.ts`)
- Primary entry point defining `IDebugAdapter` - the main contract all language adapters must implement
- Provides lifecycle management, DAP protocol operations, configuration transformation, and environment validation
- Defines comprehensive type system including `AdapterState`, `DebugFeature`, and `AdapterCapabilities`

**Adapter Policy System** (`adapter-policy.ts` + language-specific policies)
- `AdapterPolicy` interface abstracts language-specific behaviors (variable filtering, stack frame handling, command queueing)
- Language implementations: JavaScript (`js`), Python (`python`), Go (`go`), Rust (`rust`), and Mock (`mock`) policies
- Each policy handles unique requirements like Go's Delve quirks, JavaScript's multi-session child debugging, or Python's Windows Store executable detection

**Registry Pattern** (`adapter-registry.ts`)
- `IAdapterRegistry` and `IAdapterFactory` enable dynamic adapter discovery and instantiation
- Factory pattern with dependency injection for creating language-specific adapters
- Comprehensive error handling with `AdapterNotFoundError`, `FactoryValidationError`, etc.

### Multi-Session & DAP Client Behavior

**DAP Client Configuration** (`dap-client-behavior.ts`)
- `DapClientBehavior` interface defines how adapters handle reverse requests, child session management, and breakpoint mirroring
- Supports complex multi-session scenarios like JavaScript's parent/child debugging workflows
- Context-driven request handling with `DapClientContext` providing session creation utilities

**Launch Coordination** (`adapter-launch-barrier.ts`)
- `AdapterLaunchBarrier` interface enables sophisticated launch synchronization between ProxyManager and adapters
- Decouples timing of DAP responses from readiness signaling for language-specific initialization requirements

### Dependency Injection & Abstractions

**External Dependencies** (`external-dependencies.ts`)
- Comprehensive dependency injection interfaces mirroring Node.js APIs for testability
- Abstracts filesystem (`IFileSystem`), process management (`IProcessManager`), networking (`INetworkManager`), and logging (`ILogger`)
- Enables complete mocking for unit tests while maintaining production implementations

**Process Management** (`process-interfaces.ts`)
- High-level process abstraction with `IProcess`, `IProcessLauncher` interfaces
- Specialized launchers for debug targets (`IDebugTargetLauncher`) and proxy processes (`IProxyProcessLauncher`)
- Factory pattern with `IProcessLauncherFactory` for creating appropriate launcher implementations

**Filesystem Abstraction** (`filesystem.ts`)
- `FileSystem` interface with production `NodeFileSystem` implementation
- Global singleton pattern with `setDefaultFileSystem()` for dependency injection
- Error-safe operations prioritizing robustness over error propagation

## Key Patterns & Relationships

1. **Strategy Pattern**: Adapter policies encapsulate language-specific behavior strategies
2. **Factory Pattern**: Registry and launcher factories enable dynamic instantiation
3. **Dependency Injection**: External dependency interfaces enable testability and modularity
4. **Event-Driven**: Debug adapters extend EventEmitter for lifecycle and DAP event management
5. **Configuration Transformation**: Adapters transform generic configs to language-specific formats

## Public API Surface

**Primary Entry Points**:
- `IDebugAdapter` - Main adapter contract for implementing language support
- `IAdapterRegistry` - Central registry for adapter discovery and creation
- `AdapterPolicy` - Interface for implementing language-specific behaviors
- `DapClientBehavior` - Configuration for DAP client behavior customization

**Factory Interfaces**:
- `IAdapterFactory` - Creates adapter instances with dependency injection
- `IProcessLauncherFactory` - Creates process launchers for different scenarios

**Dependency Abstractions**:
- `IDependencies` - Complete dependency container for adapter construction
- Core service interfaces: `IFileSystem`, `IProcessManager`, `INetworkManager`, `ILogger`

## Data Flow

1. **Adapter Selection**: Registry matches language to appropriate adapter factory based on file extensions or configuration
2. **Instantiation**: Factory creates adapter instance with injected dependencies and language-specific policy
3. **Configuration**: Adapter transforms generic launch/attach configs to language-specific formats
4. **Coordination**: Launch barriers coordinate initialization timing between proxy manager and adapters
5. **Session Management**: DAP client behavior handles multi-session scenarios, reverse requests, and child session routing
6. **Execution**: Adapter manages DAP protocol operations through policy-defined behaviors

This architecture enables adding new language support by implementing the core interfaces while leveraging the existing infrastructure for DAP transport, session management, and process coordination.