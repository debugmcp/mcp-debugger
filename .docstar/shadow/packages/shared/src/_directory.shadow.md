# packages\shared\src/
@generated: 2026-02-12T21:06:14Z

## Overall Purpose and Responsibility

The `packages/shared/src` directory serves as the **core contract and abstraction layer** for a multi-language debug adapter system built on the VSCode Debug Adapter Protocol (DAP). This shared package provides the foundational interfaces, data models, factory patterns, and type definitions that enable consistent, extensible debugging across multiple programming languages (JavaScript, Python, Go, Rust) while maintaining strict type safety and architectural consistency.

## Key Components and Integration

### Architectural Foundation
The directory implements a **policy-based debugging architecture** that separates language-agnostic DAP transport from language-specific behaviors:

- **`interfaces/`**: Defines the complete contract layer including `IDebugAdapter`, `AdapterPolicy` strategy interfaces, dependency injection containers (`IDependencies`), and multi-session coordination patterns
- **`models/`**: Provides core data structures (`DebugSession`, `Breakpoint`) with dual-state management (lifecycle vs execution states) and DAP-compliant configuration types
- **`factories/`**: Implements the factory pattern infrastructure with `AdapterFactory` base class, metadata management, and version compatibility systems
- **`index.ts`**: Acts as the central facade, consolidating all exports into a single, type-safe entry point

### Component Relationships and Data Flow

1. **Adapter Discovery**: `IAdapterRegistry` uses factory pattern to match languages to appropriate `IAdapterFactory` implementations
2. **Policy Application**: Each adapter leverages language-specific `AdapterPolicy` implementations (JS, Python, Go, Rust) for customized behaviors
3. **Session Management**: `DebugSession` models coordinate with `SessionLifecycleState` and `ExecutionState` for comprehensive state tracking
4. **Multi-Session Support**: `DapClientBehavior` and `AdapterLaunchBarrier` interfaces enable parent-child debugging session coordination
5. **Dependency Injection**: Complete `IDependencies` container abstracts external services (filesystem, processes, networking) for testability

## Public API Surface

### Primary Entry Points
- **`IDebugAdapter`**: Main adapter contract defining lifecycle, DAP operations, and configuration transformation
- **`AdapterPolicy`**: Strategy interface for language-specific debugging behaviors
- **`IAdapterRegistry`** / **`IAdapterFactory`**: Factory-based system for adapter discovery and instantiation
- **`DebugSession`**: Central data model for session state and metadata management
- **`AdapterFactory`**: Abstract base class for creating language-specific adapter factories

### Configuration and Launch Support
- **`GenericLaunchConfig`** / **`LanguageSpecificLaunchConfig`**: Debug session configuration abstractions
- **`CustomLaunchRequestArguments`**: Extended DAP launch configuration with additional options
- **`GenericAttachConfig`**: Comprehensive attach configuration with multiple strategies (PID, name, remote)

### State Management
- **`SessionLifecycleState`** / **`ExecutionState`**: Dual-state model separating session existence from runtime status
- **`DebugLanguage`**: Enumeration of supported languages with mock support for testing
- **State mapping functions**: Backward compatibility with legacy state representations

### External Integration
- **`IDependencies`**: Complete dependency injection container with filesystem, process, network, and logging abstractions
- **VSCode Debug Protocol**: Re-exports of `@vscode/debugprotocol` types for DAP compliance
- **Multi-session coordination**: `DapClientBehavior` for reverse request handling and breakpoint mirroring

## Internal Organization Patterns

### Design Principles
- **Policy Pattern**: Language-specific behaviors isolated in `AdapterPolicy` implementations
- **Factory Pattern**: Standardized adapter creation with validation and compatibility checking  
- **Dependency Injection**: Complete abstraction of external dependencies for testing and modularity
- **Event-Driven Architecture**: All adapters extend EventEmitter for reactive debugging workflows
- **Type Safety**: Comprehensive TypeScript interfaces with runtime type guards

### Data Flow Architecture
1. **Configuration** → Session creation with language-specific transformations
2. **Factory Selection** → Policy application based on target language
3. **Lifecycle Management** → State transitions through dual-state model
4. **Protocol Operations** → DAP request/response/event handling with policy customization
5. **Multi-session Coordination** → Parent-child session management with behavioral strategies

This shared package serves as the foundational contract layer that enables the debug adapter system to support multiple programming languages through a unified, extensible, and thoroughly testable architecture while maintaining strict adherence to VSCode Debug Adapter Protocol standards.