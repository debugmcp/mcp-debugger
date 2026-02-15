# packages\shared\src\interfaces/
@children-hash: 0bfd25aa31c7b320
@generated: 2026-02-15T09:01:35Z

## Purpose
The `packages/shared/src/interfaces` directory provides the foundational TypeScript interface layer for a multi-language debug adapter system. It defines contracts for adapter behavior customization, dependency injection, and Debug Adapter Protocol (DAP) orchestration, enabling language-specific debugging implementations while maintaining a unified architecture.

## Architecture Overview
The directory implements a **policy-based adapter system** with comprehensive dependency injection, allowing debug adapters to customize their behavior through pluggable policies while sharing common infrastructure. The interfaces support both single-session and multi-session debugging scenarios with language-specific optimizations.

### Core Components

**Debug Adapter Core (`debug-adapter.ts`)**
- `IDebugAdapter` - Primary interface for language-specific debug adapters
- Defines complete lifecycle: initialization → connection → debugging → cleanup
- Supports async configuration transformation (build operations, executable resolution)
- Provides DAP protocol abstraction with typed request/response handling
- Features comprehensive capability negotiation and validation system

**Adapter Policy System (`adapter-policy*.ts`)**
- `AdapterPolicy` interface - Pluggable behavior customization contract
- Language-specific implementations: JavaScript (`js`), Python (`python`), Go (`go`), Rust (`rust`), Mock (`mock`)
- Handles variable filtering, stack frame processing, command queueing, and child session strategies
- Enables adapter-specific initialization sequences and executable validation

**Multi-Session Coordination (`dap-client-behavior.ts`, `adapter-launch-barrier.ts`)**
- `DapClientBehavior` - Configures reverse request handling and child session management
- `AdapterLaunchBarrier` - Synchronization primitive for custom launch coordination
- Supports complex debugging scenarios like JavaScript's multi-target debugging

**Registry & Factory Pattern (`adapter-registry.ts`)**
- `IAdapterRegistry` - Centralized adapter management with factory-based instantiation
- `IAdapterFactory` - Factory interface for adapter creation with dependency injection
- Comprehensive error handling with custom error taxonomy
- Instance tracking and lifecycle management

### Dependency Injection Layer
**External Dependencies (`external-dependencies.ts`, `filesystem.ts`, `process-interfaces.ts`)**
- Complete abstraction over Node.js dependencies (fs, child_process, net, etc.)
- `IDependencies` container for all required services
- Specialized interfaces for debug-specific operations (`IDebugTargetLauncher`, `IProxyProcessLauncher`)
- Enables comprehensive mocking and testing

## Key Architectural Patterns

**Policy Pattern**: Language adapters implement `AdapterPolicy` to customize behavior without modifying core transport logic.

**Factory + Registry**: Centralized adapter management with lazy instantiation and validation.

**Dependency Injection**: Complete abstraction of external dependencies for testability and modularity.

**Event-Driven**: Extensive use of EventEmitter patterns for lifecycle and protocol events.

**Strategy Pattern**: Multiple child session strategies (`none`, `launchWithPendingTarget`, `attachByPort`, `adoptInParent`) for different debugging models.

## Public API Surface

### Primary Entry Points
- `IDebugAdapter` - Main adapter interface for implementers
- `AdapterPolicy` - Behavior customization interface
- `IAdapterRegistry` - Adapter discovery and instantiation
- `DapClientBehavior` - Multi-session behavior configuration

### Language-Specific Policies
- `GoAdapterPolicy` - Delve/dlv debugging with Go runtime filtering
- `JsDebugAdapterPolicy` - VS Code js-debug with complex multi-session handshake
- `PythonAdapterPolicy` - debugpy with Windows Store Python detection
- `RustAdapterPolicy` - CodeLLDB with Cargo integration
- `MockAdapterPolicy` - Testing and development scenarios

### Utility Interfaces
- `ValidationResult`, `AdapterCapabilities`, `DebugFeature` - Core debugging primitives
- Error taxonomy: `AdapterError`, `AdapterNotFoundError`, `FactoryValidationError`
- Process abstractions: `IProcessLauncher`, `IDebugTargetLauncher`, `IProxyProcessLauncher`

## Internal Organization

**Data Flow**: Registry → Factory → Adapter → Policy → DAP Transport
1. Registry manages adapter discovery and metadata
2. Factory creates adapter instances with dependency injection
3. Adapter handles DAP protocol and lifecycle
4. Policy customizes language-specific behaviors
5. Transport layer manages actual DAP communication

**State Management**: Each adapter maintains state through `AdapterSpecificState` with policy-driven updates based on DAP commands and events.

**Multi-Session Coordination**: JavaScript-style debugging uses parent-child session coordination with `DapClientBehavior` routing commands appropriately and `AdapterLaunchBarrier` managing synchronization.

## Important Conventions

- **Async-First Design**: All I/O operations are Promise-based with <5ms performance targets
- **Optional Methods**: Many interface methods are optional to support minimal implementations
- **Error Safety**: Filesystem and process operations use safe defaults rather than propagating exceptions
- **Type Safety**: Comprehensive TypeScript interfaces with generics for DAP protocol typing
- **Extensibility**: Base classes and factory patterns enable easy addition of new language adapters

This interface layer serves as the foundation for a robust, testable, and extensible multi-language debugging system that can accommodate diverse debugging models while maintaining consistency and type safety.