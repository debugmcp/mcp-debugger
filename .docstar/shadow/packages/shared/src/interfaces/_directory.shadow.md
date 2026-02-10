# packages/shared/src/interfaces/
@generated: 2026-02-10T01:19:54Z

## Overall Purpose and Responsibility

The `packages/shared/src/interfaces` directory defines the core type system and interface contracts for a multi-language debug adapter framework. This module establishes the foundational abstractions that enable language-agnostic debugging while supporting language-specific behaviors through a pluggable policy system. It serves as the contract layer between debug adapters, the Debug Adapter Protocol (DAP), and the underlying system infrastructure.

## Key Components and Architecture

### Debug Adapter Policy System
The **adapter policy pattern** is the central architectural component, with `adapter-policy.ts` defining the `AdapterPolicy` interface and language-specific implementations (Go, Java, JavaScript, Python, Rust, Mock) providing customized behaviors for:
- Variable extraction and stack frame filtering
- Command queueing and session lifecycle management  
- Multi-session debugging strategies (child sessions, reverse requests)
- Language-specific initialization handshakes and executable resolution

### Core Debug Adapter Interface
`debug-adapter.ts` provides the `IDebugAdapter` interface - the main contract for all language-specific debug adapters. It abstracts DAP operations while enabling language customization through:
- Async configuration transformation (supporting build operations)
- Environment validation and executable resolution
- Feature capability negotiation
- Event-driven state management (UNINITIALIZED → READY → CONNECTED → DEBUGGING)

### Coordination and Behavior Configuration
- **AdapterLaunchBarrier** (`adapter-launch-barrier.ts`): Coordination mechanism for custom DAP request handling and launch synchronization
- **DapClientBehavior** (`dap-client-behavior.ts`): Configuration for reverse requests, child session routing, and debugging behaviors
- **AdapterRegistry** (`adapter-registry.ts`): Factory-based registry system for managing multiple debug adapter types

### Infrastructure Abstractions
Dependency injection interfaces enable testability and platform abstraction:
- **External Dependencies** (`external-dependencies.ts`): Core infrastructure (file system, process management, networking, logging)
- **Process Management** (`process-interfaces.ts`): High-level process abstractions for debug targets and proxy processes
- **File System** (`filesystem.ts`): Basic file operations with error-safe defaults

## Public API Surface

### Primary Entry Points
- **`IDebugAdapter`**: Main interface for implementing language-specific debug adapters
- **`AdapterPolicy`**: Interface for defining language-specific debugging behaviors
- **`IAdapterRegistry`**: Registry for managing and creating debug adapter instances
- **`AdapterLaunchBarrier`**: Coordination mechanism for custom launch behaviors

### Language-Specific Policies
Pre-built adapter policies for major languages:
- `GoAdapterPolicy`, `JavaAdapterPolicy`, `JavaScriptAdapterPolicy`
- `PythonAdapterPolicy`, `RustAdapterPolicy`, `MockAdapterPolicy`

### Configuration Interfaces
- **`DapClientBehavior`**: Customizable DAP client behaviors
- **`AdapterCapabilities`**: Feature support declaration
- **`GenericLaunchConfig`** / **`LanguageSpecificLaunchConfig`**: Configuration transformation contracts

## Internal Organization and Data Flow

### Initialization Flow
1. **Registry Registration**: Language adapters register via `IAdapterFactory` implementations
2. **Policy Selection**: Adapter policies are matched based on command patterns and language detection
3. **Environment Validation**: Executables are resolved and validated before debugging
4. **State Management**: Adapters transition through defined states with event emission
5. **Configuration Transform**: Generic configs are transformed to language-specific formats

### Multi-Session Architecture
JavaScript debugging exemplifies the sophisticated multi-session support:
- **Parent Session**: Handles breakpoints, configuration, and session orchestration
- **Child Sessions**: Execute actual debugging commands with `__pendingTargetId` adoption
- **Command Routing**: DapClientBehavior defines which commands route to parent vs. child sessions

### Command Processing Pipeline
1. **Policy Check**: `requiresCommandQueueing()` determines if commands need ordering
2. **State Gating**: `shouldQueueCommand()` enforces initialization sequence requirements
3. **Language Filtering**: Custom variable extraction and stack frame filtering per language
4. **Protocol Translation**: Generic DAP operations translated to language-specific formats

## Important Patterns and Conventions

### Policy Pattern Implementation
Each language implements the complete `AdapterPolicy` interface while sharing common infrastructure. Policies encapsulate language-specific quirks (Python's Windows Store detection, Go's runtime frame filtering, JavaScript's multi-session handshake) without polluting the core DAP transport.

### Dependency Injection Architecture
All external dependencies (filesystem, processes, network) are abstracted through interfaces, enabling comprehensive testing and platform adaptation. Factory patterns create configurable instances with proper dependency resolution.

### Event-Driven Lifecycle Management
Debug adapters follow consistent state transitions with event emission, enabling reactive coordination between components. The barrier pattern allows custom synchronization without blocking the core DAP protocol flow.

### Error Handling Strategy
Comprehensive error taxonomy with typed error codes enables precise error handling. Most operations use graceful degradation (returning safe defaults) rather than propagating exceptions.

This interface layer provides the foundation for a robust, testable, and extensible multi-language debugging system while maintaining clean separation of concerns between DAP protocol handling and language-specific behavior customization.