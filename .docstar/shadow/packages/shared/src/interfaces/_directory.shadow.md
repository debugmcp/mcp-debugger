# packages\shared\src\interfaces/
@generated: 2026-02-12T21:01:04Z

## Purpose

The `packages/shared/src/interfaces` directory defines the core abstraction layer for a multi-language debugging system built on the Debug Adapter Protocol (DAP). It provides a comprehensive set of TypeScript interfaces that enable language-agnostic debugging while supporting language-specific customizations through pluggable policies.

## Core Architecture

### Debug Adapter Framework
The directory centers around `debug-adapter.ts`, which defines the `IDebugAdapter` interface - the primary contract for all language-specific debug adapters. This interface abstracts DAP operations while supporting:
- Multi-language debugging (Python, JavaScript, Go, Rust, Mock)
- Async configuration transformation with build support
- Environment validation and executable resolution
- Connection lifecycle management
- Feature capability declaration

### Adapter Policy System
The adapter policy framework (`adapter-policy.ts`) implements a strategy pattern that allows each language to define custom behaviors:
- **Command handling**: Queueing strategies for adapters with strict initialization sequences
- **Multi-session management**: Child session creation strategies (none, launch-with-pending-target, attach-by-port)
- **Variable/stack filtering**: Language-specific filtering of internal frames and variables
- **Initialization protocols**: Custom handshake sequences (e.g., js-debug's strict ordering)

Language-specific policies are implemented in:
- `adapter-policy-js.ts`: Complex multi-session JavaScript debugging with pending targets
- `adapter-policy-python.ts`: Single-session Python with Windows Store executable detection
- `adapter-policy-go.ts`: Go/Delve debugging with goroutine handling
- `adapter-policy-rust.ts`: Rust/CodeLLDB debugging with platform-aware configuration
- `adapter-policy-mock.ts`: Testing adapter with minimal implementations

### Registry and Factory System
`adapter-registry.ts` defines interfaces for a registry pattern that manages adapter lifecycle:
- Language-to-adapter mapping with factory-based instantiation
- Async environment validation before adapter creation
- Metadata and capability discovery
- Instance tracking and disposal management

### DAP Client Behavior Configuration
`dap-client-behavior.ts` provides interfaces for customizing DAP protocol handling:
- Reverse request processing (e.g., `runInTerminal`, `startDebugging`)
- Child session command routing and breakpoint mirroring
- Session lifecycle coordination and timing configuration

### Launch Coordination
`adapter-launch-barrier.ts` defines synchronization primitives for custom launch behavior, allowing adapters to coordinate with proxy managers independently of DAP response timing.

## Dependency Injection Framework

The directory includes comprehensive abstractions for external dependencies to enable testing and modularity:

- `external-dependencies.ts`: Complete dependency container with filesystem, process management, networking, logging, and environment services
- `filesystem.ts`: Filesystem operations abstraction with error-safe implementations
- `process-interfaces.ts`: High-level process management abstractions for debug targets and proxy processes

## Key Entry Points

### Primary Interfaces
- **`IDebugAdapter`**: Main contract for language-specific debug adapters
- **`AdapterPolicy`**: Strategy interface for language-specific behaviors
- **`IAdapterRegistry`**: Registry management for adapter discovery and creation
- **`DapClientBehavior`**: DAP protocol customization configuration

### Configuration Types
- **`AdapterConfig`**: Adapter launch configuration
- **`GenericLaunchConfig`**: Language-agnostic launch parameters
- **`AdapterCapabilities`**: DAP feature support declaration

### Factory Interfaces
- **`IAdapterFactory`**: Factory pattern for adapter creation
- **`IProcessLauncherFactory`**: Process management factory

## Data Flow

1. **Registration Phase**: Language adapters register factories with metadata through `IAdapterRegistry`
2. **Discovery Phase**: Client queries available languages and validates environments
3. **Creation Phase**: Registry uses factories to create adapter instances with injected dependencies
4. **Configuration Phase**: Generic launch configs are transformed to language-specific configs via `transformLaunchConfig()`
5. **Policy Application**: Adapter policies customize DAP behavior, command handling, and session management
6. **Execution Phase**: DAP protocol operations flow through policy-filtered behaviors with optional child session management

## Architectural Patterns

- **Strategy Pattern**: AdapterPolicy enables language-specific customizations
- **Factory Pattern**: Registry-based adapter creation with validation
- **Dependency Injection**: Comprehensive abstractions for external services
- **Event-Driven Architecture**: EventEmitter-based state management and DAP event handling
- **Interface Segregation**: Specialized interfaces for different concerns (registry, policy, behavior, dependencies)

The interfaces collectively provide a flexible, testable, and extensible foundation for multi-language debugging while maintaining clean separation of concerns between transport, protocol handling, and language-specific behaviors.