# packages\shared\src/
@children-hash: e8c6a240ae7f0428
@generated: 2026-02-16T08:25:01Z

## Overall Purpose and Responsibility

The `packages/shared/src` directory serves as the foundational abstraction layer for a multi-language Debug Adapter Protocol (DAP) system. This shared module provides type-safe contracts, core data models, and standardized patterns that enable pluggable debugging capabilities across JavaScript, Python, Go, Rust, and other programming languages while maintaining a unified debugging experience.

## Key Components and Integration

### Core Architecture Components
- **Models (`models/`)**: Defines fundamental data structures including `DebugSession`, `Breakpoint`, and dual-state management system (lifecycle + execution states)
- **Interfaces (`interfaces/`)**: Provides comprehensive abstraction layer with `IDebugAdapter`, policy-driven language behaviors, and dependency injection contracts
- **Factories (`factories/`)**: Implements standardized factory pattern with `AdapterFactory` base class for consistent adapter creation and validation
- **Central Entry Point (`index.ts`)**: Consolidates all exports into a cohesive facade providing type-safe access to the entire shared ecosystem

### Integration Patterns
The components work together through several key architectural patterns:

1. **Policy-Driven Architecture**: Language-specific behaviors (JavaScript's multi-session debugging, Go's Delve quirks, Python's Windows Store detection) are encapsulated in adapter policies that implement common interfaces
2. **Factory + Registry Pattern**: `IAdapterFactory` and `IAdapterRegistry` enable dynamic adapter discovery and instantiation with dependency injection
3. **Dual-State Management**: Models provide sophisticated state tracking with both session lifecycle states and execution states, plus legacy compatibility
4. **Dependency Injection**: Comprehensive abstraction of external dependencies (filesystem, process management, networking) enables testability and modularity

## Public API Surface

### Primary Entry Points
- **`IDebugAdapter`**: Main contract that all language-specific adapters must implement for DAP protocol operations
- **`IAdapterRegistry`** and **`IAdapterFactory`**: Core registry pattern for adapter discovery and creation
- **`DebugSession`**: Central data structure orchestrating all debugging activities with metadata, state tracking, and breakpoint management
- **`AdapterPolicy`**: Base interface for implementing language-specific debugging behaviors

### Configuration and Launch System
- **`GenericAttachConfig`**: Comprehensive attachment configuration supporting PID, process name, and remote debugging modes
- **`CustomLaunchRequestArguments`**: Extensible launch configuration with debug-specific options
- **`DapClientBehavior`**: Configuration interface for DAP client behavior customization and multi-session management

### Utility and Infrastructure
- **External Dependencies**: Complete abstraction layer (`IFileSystem`, `IProcessManager`, `INetworkManager`, `ILogger`) for service composition
- **Process Abstractions**: High-level process management with specialized launchers for debug targets and proxy processes
- **State Management Utilities**: Bidirectional mapping functions between legacy and modern state models

## Internal Organization and Data Flow

### Adapter Lifecycle
1. **Discovery**: Registry matches language to appropriate adapter factory based on file extensions or configuration
2. **Creation**: Factory instantiates adapter with injected dependencies and language-specific policy
3. **Configuration**: Adapter transforms generic launch/attach configs to language-specific formats through policy behaviors
4. **Coordination**: Launch barriers manage initialization timing between proxy managers and adapters
5. **Session Management**: DAP client behavior handles complex scenarios like multi-session debugging, reverse requests, and child session routing
6. **Execution**: Adapter manages DAP protocol operations using policy-defined language-specific behaviors

### State Management Flow
- **Session Creation**: DebugSession initialized with dual-state tracking (lifecycle + execution)
- **Attachment/Launch**: Configuration objects specify connection strategies and debug parameters
- **Runtime Coordination**: Sophisticated state transitions maintain consistency across session lifecycle and execution phases
- **Breakpoint Management**: Efficient Map-based storage enables O(1) operations for breakpoint management

## Important Patterns and Conventions

- **Type Safety First**: Extensive use of TypeScript interfaces, type guards (`isAdapterFactory`, `isAdapterRegistry`), and defensive programming
- **Language Agnostic Design**: Generic interfaces with specific language extension capabilities through policy pattern
- **DAP Standard Compliance**: Built on VSCode Debug Adapter Protocol standards with re-exports for convenience
- **Extensibility Framework**: Template methods, abstract factories, and policy interfaces enable easy addition of new language support
- **Defensive Architecture**: Immutable metadata access, fallback behaviors, and comprehensive error handling throughout

## Critical Dependencies

- **`@vscode/debugprotocol`**: VSCode Debug Adapter Protocol types for standard DAP compliance
- **Internal Cohesion**: Each subdirectory provides specialized abstractions that integrate through the central index facade

This shared module serves as the contract layer that enables a pluggable debug adapter architecture, allowing new language support to be added by implementing the core interfaces while leveraging existing infrastructure for DAP transport, session management, and process coordination.