# packages\shared/
@generated: 2026-02-12T21:06:28Z

## Overall Purpose and Responsibility

The `packages/shared` directory serves as the **foundational contract and abstraction layer** for a multi-language debug adapter system built on the VSCode Debug Adapter Protocol (DAP). This shared package provides the core interfaces, data models, factory patterns, and type definitions that enable consistent, extensible debugging across multiple programming languages (JavaScript, Python, Go, Rust) while maintaining strict type safety and architectural consistency throughout the system.

## Key Components and Integration

### Core Architecture Components
- **`src/`**: Contains the complete contract layer with interfaces (`IDebugAdapter`, `AdapterPolicy`), data models (`DebugSession`, `Breakpoint`), factory patterns (`AdapterFactory`), and dependency injection systems (`IDependencies`)
- **`tests/`**: Comprehensive test suites validating the debug adapter policy implementations, particularly for JavaScript/Node.js and Rust debugging environments
- **`vitest.config.ts`**: Test configuration establishing the testing framework, coverage reporting, and module resolution for the shared package

### Component Relationships and Data Flow

The directory implements a **policy-based debugging architecture** that separates language-agnostic DAP transport from language-specific behaviors:

1. **Contract Definition**: The `src/` directory defines all interfaces and abstractions needed for multi-language debugging
2. **Policy Implementation**: Language-specific adapter policies (JS, Python, Go, Rust) customize debugging behaviors while maintaining DAP compliance
3. **Factory Pattern**: Standardized adapter creation with validation and compatibility checking across languages
4. **State Management**: Dual-state model (lifecycle vs execution) coordinated through `DebugSession` instances
5. **Testing Validation**: Comprehensive test coverage ensures policy implementations maintain protocol compliance and cross-platform compatibility

## Public API Surface

### Primary Entry Points
- **`IDebugAdapter`**: Main adapter contract defining lifecycle, DAP operations, and configuration transformation
- **`AdapterPolicy`**: Strategy interface enabling language-specific debugging behaviors
- **`IAdapterRegistry` / `IAdapterFactory`**: Factory-based system for adapter discovery and instantiation
- **`DebugSession`**: Central data model for session state and metadata management
- **`IDependencies`**: Complete dependency injection container abstracting external services

### Configuration and State Management
- **`GenericLaunchConfig` / `LanguageSpecificLaunchConfig`**: Debug session configuration abstractions
- **`SessionLifecycleState` / `ExecutionState`**: Dual-state model separating session existence from runtime status
- **`DebugLanguage`**: Enumeration of supported languages with extensibility for new language support

### Integration Support
- **DAP Protocol Compliance**: Re-exports of `@vscode/debugprotocol` types ensuring VSCode compatibility
- **Multi-session Coordination**: `DapClientBehavior` and `AdapterLaunchBarrier` for parent-child debugging sessions
- **Cross-platform Support**: Environment abstraction through dependency injection and policy patterns

## Internal Organization and Patterns

### Design Principles
- **Policy Pattern**: Language behaviors isolated in `AdapterPolicy` implementations for modularity
- **Factory Pattern**: Standardized adapter creation with metadata management and version compatibility
- **Dependency Injection**: Complete abstraction of external dependencies for testing and modularity
- **Event-Driven Architecture**: EventEmitter-based reactive debugging workflows
- **Type Safety**: Comprehensive TypeScript interfaces with runtime validation

### Testing Strategy
- **Mock-Based Architecture**: Comprehensive mocking of file system, processes, and DAP communications
- **Protocol Validation**: Ensures DAP compliance across all language-specific implementations
- **Cross-Platform Testing**: Platform simulation and environment-specific behavior validation
- **Integration Testing**: Validates the critical translation layer between debug sessions and language adapters

This shared package serves as the architectural foundation enabling the debug adapter system to support multiple programming languages through a unified, extensible, and thoroughly testable framework while maintaining strict adherence to VSCode Debug Adapter Protocol standards. It provides the essential abstraction layer that allows language-specific debug adapters to integrate seamlessly into a cohesive multi-language debugging experience.