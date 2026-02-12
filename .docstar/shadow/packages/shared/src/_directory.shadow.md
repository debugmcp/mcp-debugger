# packages\shared\src/
@generated: 2026-02-12T21:01:24Z

## Overall Purpose and Responsibility

The `packages/shared/src` directory serves as the foundational abstraction layer for a comprehensive multi-language debugging system built on the VSCode Debug Adapter Protocol (DAP). It provides a unified, type-safe contract that enables pluggable debug adapter architectures while maintaining language-specific customization capabilities across Python, JavaScript, Go, Rust, and other languages.

## Key Components and Architecture

### Core Debug Adapter Framework
The system centers around the `IDebugAdapter` interface, which abstracts DAP operations while supporting language-specific behaviors through a sophisticated **adapter policy system**. Each language implements custom policies for command handling, session management, variable filtering, and initialization protocols, enabling specialized debugging strategies (e.g., JavaScript's multi-session pending targets, Python's Windows Store executable detection).

### Factory and Registry Pattern
A comprehensive factory/registry system manages adapter lifecycle through `IAdapterRegistry` and `IAdapterFactory` interfaces. The `BaseAdapterFactory` in the factories directory provides standardized adapter creation with validation, version compatibility checking, and metadata management. This enables runtime adapter discovery, environment validation, and consistent instantiation across all supported languages.

### Data Models and State Management
The models directory provides sophisticated session state management through a dual-state system separating lifecycle concerns (`SessionLifecycleState`) from execution state (`ExecutionState`). The `DebugSession` serves as the central data container, while comprehensive launch and attach configuration models support multiple connection strategies and language-agnostic debugging operations.

### Dependency Injection and External Abstractions
Complete abstractions for external dependencies (`IFileSystem`, `IChildProcess`, `INetworkManager`, `ILogger`) enable testability and modularity. Process management interfaces provide high-level abstractions for debug targets and proxy processes, while the barrier system coordinates custom launch behaviors independent of DAP timing.

## Public API Surface

### Primary Entry Points
- **`IDebugAdapter`** - Main contract for all language-specific debug adapters
- **`IAdapterRegistry`** - Adapter discovery, validation, and instantiation management
- **`AdapterPolicy`** - Strategy interface for language-specific behavior customization
- **`DebugSession`** - Central session data structure with comprehensive state management
- **`BaseAdapterFactory`** - Template for creating language-specific adapter factories

### Configuration and Launch Management
- **`GenericLaunchConfig`, `CustomLaunchRequestArguments`** - Language-agnostic launch configuration
- **`GenericAttachConfig`** - Multi-modal attach configuration (PID, process name, remote)
- **`AdapterConfig`, `AdapterCapabilities`** - Adapter runtime configuration and feature declaration

### Client Behavior and Protocol Customization
- **`DapClientBehavior`** - DAP protocol handling customization
- **`AdapterLaunchBarrier`** - Launch coordination primitives
- **Language-specific policies** - `JsDebugAdapterPolicy`, `PythonAdapterPolicy`, etc.

## Internal Organization and Data Flow

The architecture follows a layered approach:

1. **Interface Layer** (`interfaces/`) - Core abstractions and contracts
2. **Factory Layer** (`factories/`) - Standardized creation patterns with validation
3. **Model Layer** (`models/`) - Data structures and state management
4. **Integration Layer** (`index.ts`) - Unified API facade

**Data Flow**: Configuration → Factory validation → Adapter creation → Policy application → Session management → DAP protocol operations, with comprehensive dependency injection and state coordination throughout.

## Architectural Patterns and Conventions

### Design Patterns
- **Strategy Pattern**: AdapterPolicy enables language-specific customizations
- **Factory Pattern**: Registry-based adapter creation with environment validation
- **Facade Pattern**: Single entry point consolidating multiple interface modules
- **Template Method**: BaseAdapterFactory provides structure for concrete implementations
- **Dependency Injection**: Complete abstraction of external services

### Key Conventions
- **Type Safety**: Extensive TypeScript interfaces with runtime type guards
- **Extensibility**: Index signatures and placeholder comments support future language additions
- **Backward Compatibility**: Legacy state mapping maintains existing integrations
- **Permissive Defaults**: Factories considered valid unless explicitly overridden
- **DAP Integration**: Seamless integration with VSCode Debug Adapter Protocol standards

## Critical Integration Points

This shared package serves as the contract layer between the core debugger infrastructure and language-specific implementations, enabling:
- **Pluggable adapter architectures** with consistent interfaces
- **Cross-language debugging capabilities** while preserving language-specific optimizations  
- **Comprehensive testing support** through dependency abstraction and mock implementations
- **Runtime adapter discovery** and validation before debug session creation
- **Standardized configuration transformation** from generic to language-specific parameters

The module provides the essential foundation for building scalable, maintainable debug adapter ecosystems that can grow to support additional languages while maintaining type safety and architectural consistency.