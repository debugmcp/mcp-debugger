# packages\shared\src/
@children-hash: 7da72022061175f4
@generated: 2026-02-21T08:29:04Z

## Overall Purpose and Responsibility

The `packages/shared/src` directory serves as the foundational shared library for the MCP Debugger, providing a comprehensive type-safe abstraction layer that enables multi-language debugging capabilities across JavaScript, Python, Go, Rust, and other languages. This module implements a plugin-based architecture built on the Debug Adapter Protocol (DAP), allowing language-specific debug adapters to integrate seamlessly while maintaining consistent interfaces and behaviors.

## Key Components and Integration

### Core Architecture Layers

**Interface Abstraction Layer** (`interfaces/`)
- Defines the primary contracts through `IDebugAdapter`, `IAdapterRegistry`, and `IAdapterFactory`
- Implements policy-driven architecture via `AdapterPolicy` for language-specific behaviors
- Provides dependency injection interfaces for external services (filesystem, process management, networking)
- Handles DAP client behavior customization and multi-session coordination

**Data Model Foundation** (`models/`)
- Extends VS Code DAP with comprehensive session lifecycle management
- Implements dual-state architecture separating session lifecycle from execution state
- Provides debug runtime constructs (breakpoints, variables, stack frames)
- Maintains backward compatibility through legacy state mapping utilities

**Factory Pattern Implementation** (`factories/`)
- Provides `AdapterFactory` base class for consistent adapter creation
- Implements template method pattern with validation and compatibility checking
- Supports semantic versioning and prerequisite validation
- Enables extensible factory registration across language implementations

**Unified API Surface** (`index.ts`)
- Acts as central facade consolidating all interfaces, models, and utilities
- Provides type-safe exports organized by functional area
- Re-exports DAP protocol types for convenience
- Serves as the primary integration point for consuming applications

## Component Relationships and Data Flow

The architecture follows a layered approach where:

1. **Configuration Phase**: Generic launch/attach configs are transformed via adapter policies to language-specific formats
2. **Registration**: Factory pattern enables dynamic adapter discovery and instantiation through the registry system
3. **Session Management**: Debug sessions track both lifecycle state and execution state through the dual-state model
4. **Runtime Coordination**: Launch barriers synchronize adapter initialization while DAP client behaviors handle multi-session scenarios
5. **Protocol Operations**: Adapters execute DAP commands through policy-defined behaviors with dependency injection for external services

## Public API Surface

### Primary Entry Points
- **`IDebugAdapter`**: Main contract for implementing language-specific debug support
- **`IAdapterRegistry`**: Central registry for adapter discovery and factory management
- **`AdapterPolicy`**: Interface for encapsulating language-specific debugging behaviors
- **`DebugSession`**: Complete session state management with lifecycle tracking

### Factory and Creation APIs
- **`IAdapterFactory`**: Base factory interface for adapter instantiation
- **`AdapterFactory`**: Abstract base class with validation and compatibility checking
- **`IProcessLauncherFactory`**: Process management factory for debug target launching

### Data Models
- **Configuration**: `GenericAttachConfig`, `CustomLaunchRequestArguments`, `LanguageSpecificAttachConfig`
- **Runtime State**: `SessionLifecycleState`, `ExecutionState`, `Breakpoint`, `Variable`, `StackFrame`
- **Language Support**: `DebugLanguage` enum with comprehensive language-specific policy implementations

### Dependency Abstractions
- **`IDependencies`**: Complete dependency injection container
- **Service Interfaces**: `IFileSystem`, `IProcessManager`, `INetworkManager`, `ILogger`, `IServer`

## Internal Organization and Design Patterns

**Strategy Pattern**: Language-specific behaviors are encapsulated in adapter policies, allowing the core system to remain generic while accommodating language quirks like Go's Delve debugging specifics or JavaScript's multi-session child process debugging.

**Factory Pattern**: Comprehensive factory system enables dynamic adapter creation with dependency injection and validation, supporting both built-in and extensible language implementations.

**Dependency Injection**: Complete abstraction of external dependencies enables comprehensive unit testing while maintaining production implementations for Node.js environments.

**Event-Driven Architecture**: Debug adapters extend EventEmitter for lifecycle management and DAP event coordination.

**Backward Compatibility**: Legacy state management interfaces are maintained with clear migration paths, enabling gradual system evolution without breaking existing integrations.

This shared module serves as the critical foundation enabling the MCP Debugger to support multiple programming languages through a consistent, extensible, and type-safe architecture while maintaining compatibility with standard debugging tools and protocols.