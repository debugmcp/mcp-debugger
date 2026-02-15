# packages\shared\src/
@children-hash: b3b1b2c2545a3e0c
@generated: 2026-02-15T09:01:53Z

## Overall Purpose

The `packages/shared/src` directory serves as the foundational contract layer for a comprehensive multi-language debug adapter system built on the Debug Adapter Protocol (DAP). It provides the shared abstractions, interfaces, and type definitions that enable consistent debugging experiences across multiple programming languages (JavaScript, Python, Go, Rust) while maintaining extensibility and type safety.

## Key Components and Integration

### Core Architecture
The directory implements a **policy-based adapter system** with four main architectural layers:

1. **Models Layer** (`models/`): Defines core data structures including `DebugSession`, `Breakpoint`, and sophisticated dual-state management (`SessionLifecycleState` + `ExecutionState`)
2. **Interfaces Layer** (`interfaces/`): Provides contracts for adapter behavior (`IDebugAdapter`), customization policies (`AdapterPolicy`), and comprehensive dependency injection (`IDependencies`)
3. **Factory Layer** (`factories/`): Implements standardized adapter creation patterns with version compatibility and validation frameworks
4. **Central Entry Point** (`index.ts`): Consolidates all exports into a cohesive facade for consuming packages

### Component Relationships
- **Registry → Factory → Adapter → Policy** data flow enables pluggable debug adapter architectures
- **Dependency Injection** abstracts all external dependencies (filesystem, processes, networking) for testability
- **Language-Specific Policies** customize behavior without modifying core transport logic
- **Multi-Session Coordination** supports complex debugging scenarios through `DapClientBehavior` and synchronization primitives

## Public API Surface

### Primary Entry Points
- **`IDebugAdapter`**: Main interface for implementing language-specific debug adapters with complete lifecycle management
- **`AdapterPolicy` + Language Implementations**: Behavior customization contracts (`JsDebugAdapterPolicy`, `PythonAdapterPolicy`, `GoAdapterPolicy`, `RustAdapterPolicy`)
- **`IAdapterRegistry` + `IAdapterFactory`**: Centralized adapter management with factory-based instantiation
- **`DebugSession`**: Core session management data structure with dual-state tracking

### Configuration and State Management
- **Launch/Attach Configurations**: `GenericLaunchConfig`, `GenericAttachConfig`, `CustomLaunchRequestArguments`
- **State Enums**: `DebugLanguage`, `SessionLifecycleState`, `ExecutionState` with legacy compatibility
- **Validation Framework**: `ValidationResult`, `AdapterCapabilities`, `DebugFeature`

### Utility Services
- **Dependency Abstractions**: Complete Node.js abstraction layer (`IFileSystem`, `IChildProcess`, `IProcessManager`)
- **Process Management**: Debug-specific interfaces (`IDebugTargetLauncher`, `IProxyProcessLauncher`)
- **Synchronization**: `AdapterLaunchBarrier` for custom launch coordination

## Internal Organization and Data Flow

### Standard Adapter Lifecycle
1. **Discovery**: Registry manages adapter metadata and compatibility validation
2. **Creation**: Factory instantiates adapters with dependency injection
3. **Initialization**: Adapter performs async configuration transformation and validation
4. **Connection**: DAP protocol establishment with capability negotiation
5. **Debugging**: Policy-driven behavior customization for language-specific operations
6. **Cleanup**: Structured teardown with resource management

### Multi-Session Support
- **Parent-Child Coordination**: JavaScript-style debugging with reverse request routing
- **Synchronization Primitives**: Launch barriers and lifecycle coordination
- **Child Session Strategies**: Multiple attachment modes (`launchWithPendingTarget`, `attachByPort`, `adoptInParent`)

## Key Architectural Patterns

- **Facade Pattern**: `index.ts` provides unified access to all shared functionality
- **Policy Pattern**: Language-specific behavior through pluggable policy interfaces
- **Factory + Registry**: Centralized adapter lifecycle with lazy instantiation
- **Dependency Injection**: Complete abstraction layer for external dependencies and testing
- **Template Method**: Base factory implementations with extensible validation hooks

## Critical Design Decisions

- **Type Safety First**: Comprehensive TypeScript interfaces with DAP protocol integration
- **Async-First Design**: All I/O operations are Promise-based with performance targets
- **Language Agnostic Core**: Generic interfaces with language-specific extension points
- **Backward Compatibility**: Legacy state mapping functions maintain API stability
- **Extensible Foundation**: New language adapters can be added without core modifications

This shared package serves as the essential contract layer that enables the broader MCP Debugger ecosystem to maintain consistency, type safety, and extensibility across multiple programming language implementations while providing a robust foundation for complex debugging scenarios.