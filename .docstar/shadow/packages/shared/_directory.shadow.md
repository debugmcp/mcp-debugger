# packages/shared/
@generated: 2026-02-10T01:20:43Z

## Overall Purpose and Responsibility

The `packages/shared` directory serves as the foundational shared library for a multi-language debug adapter framework built on the VS Code Debug Adapter Protocol (DAP). This module provides the complete infrastructure for language-agnostic debugging capabilities while supporting language-specific customizations through a sophisticated policy-based architecture. It acts as the core abstraction layer that enables consistent debugging experiences across multiple programming languages (Go, Java, JavaScript, Python, Rust) within VS Code and similar development environments.

## Key Components and Integration

### Core Architecture Layers

**Type System and Contracts (`src/interfaces/`)**
- **IDebugAdapter**: Primary interface defining the debug adapter contract with async configuration, validation, and state management
- **AdapterPolicy**: Strategy pattern interface enabling language-specific debugging behaviors
- **IAdapterRegistry**: Factory-based registry system for managing multiple debug adapter types
- **Infrastructure Abstractions**: Dependency injection interfaces for system resources (file system, process management, networking)

**Factory and Registry System (`src/factories/`)**
- **AdapterFactory**: Abstract base class enforcing consistent adapter instantiation patterns
- **Metadata Management**: Standardized adapter metadata with version compatibility checking
- **Validation Framework**: Extensible validation system with graceful defaults

**Data Models (`src/models/`)**
- **Session Management**: Complete debug session lifecycle with dual-state tracking
- **Debug Structures**: Runtime data types for variables, stack frames, breakpoints
- **Configuration Types**: Launch and attach configurations supporting multiple languages

**Language-Specific Policies**
Pre-built adapter policies for supported languages, each customizing debugging behavior without modifying core infrastructure. The JavaScript policy handles complex multi-session coordination, Python handles Windows Store detection, Go manages goroutine filtering, etc.

**Comprehensive Test Coverage (`tests/`)**
Language-specific adapter policy tests ensuring DAP compliance, cross-platform compatibility, and robust integration with various debugging toolchains.

### Component Integration Flow

1. **Registration**: Language adapters register via `IAdapterFactory` implementations in the central registry
2. **Discovery**: Registry matches adapter policies based on command patterns and language detection
3. **Instantiation**: Factory creates adapter instances with proper dependency injection
4. **Policy Application**: Language-specific policies customize debugging behavior through the strategy pattern
5. **State Management**: Adapters transition through defined lifecycle states with comprehensive validation
6. **Protocol Translation**: Generic operations translate to language-specific debug commands via policies

## Public API Surface

### Primary Entry Points

**Debug Adapter Integration**
- `IDebugAdapter`: Main interface for implementing language-specific debug adapters
- `AdapterFactory`: Base class for creating adapter factories with validation and compatibility
- `IAdapterRegistry`: Registry for managing adapter discovery and instantiation

**Language-Specific Policies**
- Pre-built policies: `GoAdapterPolicy`, `JavaAdapterPolicy`, `JavaScriptAdapterPolicy`, `PythonAdapterPolicy`, `RustAdapterPolicy`, `MockAdapterPolicy`
- `AdapterPolicy`: Interface for implementing custom language behaviors

**Configuration and Session Management**
- `CustomLaunchRequestArguments`: Enhanced DAP launch configuration
- `GenericAttachConfig`: Flexible attachment supporting PID, process name, remote connections
- `DebugSession`, `SessionLifecycleState`, `ExecutionState`: Complete session state management

**Infrastructure Abstractions**
- `IDependencies`: Dependency injection container for system resources
- `IFileSystem`, `IProcessManager`, `INetworkManager`: Pluggable infrastructure interfaces

### Framework Integration Points

**VS Code DAP Compatibility**
- Direct re-export of VS Code Debug Protocol types for seamless integration
- Enhanced launch configurations extending standard DAP capabilities
- Custom behavior configuration through `DapClientBehavior` interface

**Multi-Language Debugging Support**
- `DebugLanguage` enum defining supported languages
- Generic configuration types with language-specific transformations
- Consistent validation and error handling across all languages

## Internal Organization and Data Flow

### Dependency Injection Architecture
All external dependencies flow through well-defined interfaces, enabling comprehensive unit testing, platform adaptation, and clean separation between debug logic and system resources. The Node.js defaults can be replaced with alternative implementations for different runtime environments.

### Policy-Driven Customization
The strategy pattern allows each programming language to customize debugging behavior without modifying the core infrastructure. This enables specialized handling of language-specific concerns like multi-session coordination (JavaScript), virtual environments (Python), or goroutine management (Go).

### State Management Evolution
The module supports both modern hierarchical state tracking and legacy flat state models through bidirectional mapping functions, ensuring backward compatibility while enabling advanced debugging scenarios.

### Error Handling and Resilience
Comprehensive error taxonomy with typed error codes, graceful degradation with safe defaults, and validation framework with permissive defaults that favor operational success over strict validation.

This shared library provides the foundational infrastructure enabling robust, testable, and extensible multi-language debugging while maintaining clean architectural boundaries and comprehensive type safety throughout the debug ecosystem. It serves as the central nervous system for debug adapter coordination in multi-language development environments.