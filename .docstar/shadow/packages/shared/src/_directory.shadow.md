# packages/shared/src/
@generated: 2026-02-10T21:26:50Z

## Purpose
The `packages/shared/src` directory serves as the foundational shared library for a multi-language Model Context Protocol (MCP) debugger system. It provides a comprehensive set of interfaces, types, factories, and models that enable language-specific debug adapters to integrate seamlessly with VS Code's Debug Adapter Protocol (DAP) while maintaining consistent behavior across different programming languages.

## Architecture Overview

The directory implements a **layered architecture** with clean separation between abstractions and implementations:

### Core Abstraction Layer (`interfaces/`)
- **Debug Adapter Contracts**: `IDebugAdapter` interface defining the standard lifecycle and DAP operations
- **Policy-Based Architecture**: `AdapterPolicy` system enabling language-specific behaviors (variable extraction, stack filtering, command queueing) while maintaining a unified transport layer
- **Registry System**: Factory pattern with `IAdapterRegistry` and `IAdapterFactory` for adapter discovery, creation, and lifecycle management
- **Dependency Injection**: Comprehensive abstractions over Node.js built-ins (filesystem, processes, networking) for testability and modularity
- **Multi-Session Coordination**: Launch barriers and DAP client behaviors for complex debugging scenarios like JavaScript parent-child session management

### Factory Infrastructure (`factories/`)
- **Standardized Creation**: `AdapterFactory` abstract base class enforcing consistent adapter instantiation patterns
- **Version Compatibility**: Semantic versioning system with core debugger compatibility checking
- **Validation Framework**: Extensible validation hooks with metadata management and defensive programming practices
- **Template Method Pattern**: Base implementations with customization points for language-specific requirements

### Data Models (`models/`)
- **Session Management**: `DebugSession` and `DebugSessionInfo` with dual-state architecture (lifecycle vs execution states)
- **Runtime Representation**: `Variable`, `StackFrame`, `BreakPoint` models for debugging artifacts
- **Configuration System**: Generic launch/attach configurations with language-specific extensions
- **Legacy Compatibility**: Bidirectional state mapping for gradual modernization without breaking existing integrations

## Key Components Integration

### Multi-Language Support Flow
1. **Registration**: Language adapters register policies and factories with the central registry
2. **Discovery**: Clients query registry for available languages and capabilities
3. **Instantiation**: Factories create adapters with injected dependencies and validation
4. **Configuration**: Generic configs transformed to language-specific formats via policy system
5. **Execution**: DAP requests flow through policy-filtered handlers with session coordination

### Dependency Management
The system uses extensive dependency injection with interfaces for:
- **System Resources**: File system, process management, networking abstractions
- **Debug Infrastructure**: Process launchers, target managers, proxy systems
- **Service Layer**: Logging, configuration, and state management services

### State Management Architecture
- **Modern Design**: Separate lifecycle (CREATED→ACTIVE→TERMINATED) and execution states
- **Legacy Bridge**: Backward-compatible mapping functions for existing consumers
- **Event-Driven**: State changes propagated through EventEmitter patterns

## Public API Surface

### Primary Entry Points
- **`IDebugAdapter`**: Main interface for implementing language-specific debug adapters
- **`IAdapterRegistry`** & **`IAdapterFactory`**: Adapter registration and creation
- **`AdapterPolicy`**: Language-specific behavior customization interface
- **`DebugSession`**: Complete session state management with breakpoint tracking
- **Configuration Types**: `GenericLaunchConfig`, `CustomLaunchRequestArguments`, `GenericAttachConfig`

### Core Enums and Types
- **`DebugLanguage`**: Supported languages (Python, JavaScript, Java, Rust, Go, Mock)
- **`SessionLifecycleState`** & **`ExecutionState`**: Modern dual-state system
- **`AdapterState`**: Adapter lifecycle tracking
- **`DebugFeature`**: Capability declarations for feature negotiation

### Utility Functions
- **Type Guards**: Runtime type checking for adapter factories and registries
- **State Mapping**: Legacy compatibility helpers (`mapLegacyState`, `mapToLegacyState`)
- **Version Comparison**: Semantic versioning utilities for compatibility checking

## Key Design Patterns

- **Interface Segregation**: Clean separation between types and implementations
- **Strategy Pattern**: Pluggable language policies for adapter-specific behaviors
- **Factory Pattern**: Centralized, validated adapter creation
- **Registry Pattern**: Dynamic adapter discovery and management
- **Template Method**: Base factory with customizable validation and compatibility hooks
- **Dependency Injection**: Complete abstraction of external dependencies for testing
- **Event-Driven Architecture**: Async state management with performance targets < 5ms

## Critical Conventions

- All adapters must emit state change events for lifecycle management
- Multi-session adapters coordinate through launch barriers to prevent protocol violations
- Version compatibility only enforced when `minimumDebuggerVersion` is specified
- Language policies provide safe defaults for all optional operations
- Complete VS Code DAP compliance maintained while adding custom extensions

This shared module serves as the **architectural foundation** enabling a unified debugging experience across multiple programming languages while preserving the unique characteristics each language requires.