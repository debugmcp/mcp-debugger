# packages/shared/src/
@generated: 2026-02-11T23:48:07Z

## Overall Purpose and Responsibility

The `packages/shared/src` directory serves as the foundational shared library for the MCP Debugger ecosystem, providing a comprehensive type-safe abstraction layer that enables multi-language debug adapter development. This module establishes the core architectural contracts, data models, and factory patterns that allow different programming languages (JavaScript, Python, Go, Rust) to integrate with a unified Debug Adapter Protocol (DAP) framework while maintaining language-specific customization capabilities.

## Key Components and Integration

### Core Architecture Layers

**Interface Layer (`interfaces/`)**
- Defines the primary contracts (`IDebugAdapter`, `AdapterPolicy`, `DapClientBehavior`) that all language adapters must implement
- Provides dependency injection abstractions for external services (filesystem, process management, networking)
- Establishes the adapter registry and factory pattern interfaces for pluggable architecture
- Language-specific policy implementations (JavaScript, Python, Go, Rust, Mock) customize debugging behaviors

**Factory Layer (`factories/`)**
- Implements the standardized adapter creation pattern through `AdapterFactory` base class
- Provides template method pattern for consistent validation, compatibility checking, and instantiation
- Manages semantic versioning and compatibility verification across adapter implementations
- Serves as the foundation for the plugin architecture enabling language-specific customization

**Data Model Layer (`models/`)**
- Defines core debugging entities (`DebugSession`, `Breakpoint`, `Variable`, `StackFrame`)
- Implements sophisticated dual-state management separating session lifecycle from execution state
- Provides language-agnostic configuration interfaces with extension points
- Maintains VSCode Debug Adapter Protocol compliance while adding custom extensions

**Central Export (`index.ts`)**
- Acts as the unified facade providing type-safe access to all shared abstractions
- Consolidates interfaces, models, factories, and utilities into a single entry point
- Re-exports external dependencies (@vscode/debugprotocol) for convenience

## Public API Surface

### Main Entry Points
- **`index.ts`**: Primary module export providing access to all shared abstractions
- **`IDebugAdapter`**: Core adapter interface that language implementations must satisfy
- **`AdapterPolicy`**: Strategy interface for language-specific debugging behaviors
- **`AdapterFactory`**: Base factory class for standardized adapter creation
- **`IAdapterRegistry`**: Registry interface for managing and discovering debug adapters

### Language Integration Points
- **Policy Implementations**: `JsDebugAdapterPolicy`, `PythonAdapterPolicy`, `GoAdapterPolicy`, `RustAdapterPolicy`
- **Factory Pattern**: `IAdapterFactory` and `BaseAdapterFactory` for consistent adapter instantiation
- **Configuration Interfaces**: `GenericLaunchConfig`, `GenericAttachConfig`, `CustomLaunchRequestArguments`

### State Management APIs
- **Session Models**: `DebugSession`, `SessionConfig`, `DebugSessionInfo`
- **State Enums**: `SessionLifecycleState`, `ExecutionState`, `DebugLanguage`
- **Debug Entities**: `Breakpoint`, `Variable`, `StackFrame`, `DebugLocation`

## Internal Organization and Data Flow

1. **Adapter Discovery**: Registry system locates appropriate adapter factories for target languages
2. **Adapter Creation**: Factory pattern validates, checks compatibility, and instantiates language-specific adapters
3. **Session Management**: Dual-state system tracks both session lifecycle and execution state independently
4. **Protocol Handling**: Adapters implement DAP protocol operations with language-specific behaviors via policy pattern
5. **Dependency Resolution**: Comprehensive dependency injection system provides testable abstractions for external services

## Critical Design Patterns

**Strategy Pattern**: Language-specific policies customize debugging behavior while maintaining unified interface
**Factory Pattern**: Standardized adapter creation with validation and compatibility verification
**Dependency Injection**: Comprehensive abstraction layer enables testing and different runtime environments
**Template Method**: Base implementations provide structure while allowing customization through inheritance
**Facade Pattern**: Single entry point consolidates complex subsystem interfaces

## Integration Context

This shared package serves as the contract layer between the core MCP Debugger and language-specific implementations, enabling:
- Pluggable debug adapter architecture supporting multiple programming languages
- Type-safe development with comprehensive TypeScript interfaces
- Consistent debugging experience across different language ecosystems
- Testable architecture through dependency injection and mock implementations
- Future language support through extensible factory and policy patterns

The module maintains strict adherence to VSCode Debug Adapter Protocol standards while providing the flexibility needed for language-specific debugging requirements and custom extensions.