# packages\shared/
@generated: 2026-02-12T21:01:42Z

## Overall Purpose and Responsibility

The `packages/shared` directory serves as the foundational abstraction layer and common contract for a comprehensive multi-language debugging framework built on the VSCode Debug Adapter Protocol (DAP). This shared package provides the unified interfaces, data models, and testing infrastructure that enable consistent debugging experiences across Python, JavaScript, Go, Rust, and other languages while maintaining language-specific customization capabilities.

## Key Components and Integration

### Core Architecture (`src/`)
The heart of the shared package centers around the `IDebugAdapter` interface and adapter policy system, which provides:
- **Unified Debug Contract**: Common interface abstraction for all language-specific debug adapters
- **Policy-Based Customization**: `AdapterPolicy` strategy pattern enabling language-specific behaviors (session management, variable filtering, initialization protocols)
- **Factory/Registry System**: Standardized adapter creation, validation, and lifecycle management through `IAdapterRegistry` and `BaseAdapterFactory`
- **Comprehensive Data Models**: Session state management, launch/attach configurations, and DAP protocol abstractions

### Dependency Injection Framework
Complete abstractions for external dependencies (`IFileSystem`, `IChildProcess`, `INetworkManager`, `ILogger`) enable:
- Full testability through mock implementations
- Modular architecture with pluggable components
- Platform-agnostic operation across different environments

### Testing Infrastructure (`tests/`)
Comprehensive unit test suite validating:
- Language-specific adapter policy implementations
- DAP protocol compliance and command handling
- Cross-platform compatibility and configuration
- Mock-based testing patterns with systematic cleanup

### Build and Configuration (`vitest.config.ts`)
Standardized testing configuration providing:
- Istanbul-based code coverage reporting
- TypeScript and Node.js environment support
- Module resolution with path aliasing for clean imports

## Public API Surface

### Primary Entry Points
- **`IDebugAdapter`** - Main contract implemented by all language adapters
- **`IAdapterRegistry`** - Adapter discovery, validation, and instantiation management
- **`DebugSession`** - Central session data container with comprehensive state management
- **`AdapterPolicy`** - Strategy interface for language-specific behavior customization
- **`BaseAdapterFactory`** - Template pattern for creating language-specific adapter factories

### Configuration and Launch Management
- **`GenericLaunchConfig`, `GenericAttachConfig`** - Language-agnostic debugging configuration models
- **`AdapterConfig`, `AdapterCapabilities`** - Runtime configuration and feature declaration
- **`CustomLaunchRequestArguments`** - Flexible launch parameter handling

### Protocol and Client Behavior
- **`DapClientBehavior`** - DAP protocol handling customization
- **`AdapterLaunchBarrier`** - Launch coordination primitives
- **Language-specific policies** - `JsDebugAdapterPolicy`, `PythonAdapterPolicy`, `RustAdapterPolicy`

## Internal Organization and Data Flow

The architecture follows a layered approach with clear separation of concerns:

1. **Interface Layer** - Core abstractions and contracts defining the debugging framework
2. **Factory Layer** - Standardized creation patterns with validation and environment checking
3. **Model Layer** - Data structures for session management and configuration
4. **Integration Layer** - Unified API facade consolidating all components

**Data Flow**: Configuration validation → Factory-based adapter creation → Policy application for language-specific behavior → Session lifecycle management → DAP protocol operations, with comprehensive dependency injection throughout.

## Architectural Patterns and Conventions

### Design Patterns
- **Strategy Pattern**: Enables pluggable language-specific behaviors through adapter policies
- **Factory/Registry Pattern**: Centralized adapter creation and lifecycle management
- **Facade Pattern**: Single entry point (`index.ts`) consolidating multiple interface modules
- **Dependency Injection**: Complete abstraction enabling testability and modularity
- **Template Method**: Standardized base implementations for consistent behavior

### Key Conventions
- **Type Safety**: Extensive TypeScript interfaces with runtime validation
- **Extensibility**: Index signatures and structured patterns supporting future language additions
- **DAP Integration**: Seamless integration with VSCode Debug Adapter Protocol standards
- **Testing-First**: Comprehensive mock-based testing infrastructure with consistent cleanup patterns
- **Platform Agnostic**: Cross-platform compatibility with environment-specific optimizations

## Critical Integration Role

This shared package serves as the essential contract layer between core debugger infrastructure and language-specific implementations, enabling:
- **Pluggable Adapter Architecture**: Consistent interfaces allowing runtime adapter discovery and validation
- **Cross-Language Debugging**: Unified debugging experiences while preserving language-specific optimizations
- **Scalable Testing**: Mock-based infrastructure supporting comprehensive validation of complex debugging scenarios
- **Framework Evolution**: Extensible design patterns supporting addition of new languages and debugging capabilities

The `packages/shared` directory provides the foundational architecture for building maintainable, type-safe debug adapter ecosystems that can scale across multiple programming languages while maintaining consistent behavior and protocol compliance.