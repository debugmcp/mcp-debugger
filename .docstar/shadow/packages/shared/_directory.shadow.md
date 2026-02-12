# packages/shared/
@generated: 2026-02-11T23:48:27Z

## Overall Purpose and Responsibility

The `packages/shared` directory serves as the foundational shared library for the MCP Debugger ecosystem, providing a comprehensive type-safe abstraction layer that enables multi-language debug adapter development. This package establishes the architectural contracts, data models, and factory patterns that allow different programming languages (JavaScript, Python, Go, Rust) to integrate with a unified Debug Adapter Protocol (DAP) framework while maintaining language-specific customization capabilities.

## Key Components and Integration

### Core Architecture (`src/`)
The source directory implements a layered architecture with distinct responsibilities:

- **Interface Layer**: Defines primary contracts (`IDebugAdapter`, `AdapterPolicy`, `DapClientBehavior`) that all language adapters must implement, along with dependency injection abstractions for external services
- **Factory Layer**: Implements standardized adapter creation through `AdapterFactory` base class with template method pattern for validation, compatibility checking, and instantiation
- **Data Model Layer**: Defines core debugging entities (`DebugSession`, `Breakpoint`, `Variable`, `StackFrame`) with sophisticated dual-state management separating session lifecycle from execution state
- **Central Export**: Acts as unified facade providing type-safe access to all shared abstractions through `index.ts`

### Testing Infrastructure (`tests/`)
Comprehensive test suite validating the adapter policy layer through:
- Unit tests for language-specific adapter policies (JavaScript, Rust)
- Cross-platform validation ensuring compatibility across operating systems
- DAP protocol compliance verification using `@vscode/debugprotocol` types
- Sophisticated mocking patterns for file system, process, and adapter dependencies

### Build Configuration (`vitest.config.ts`)
Standard Vitest configuration enabling:
- Node.js test environment for server-side testing
- Istanbul-based code coverage with multiple output formats
- Module resolution with TypeScript support and path aliases

## Public API Surface

### Primary Entry Points
- **`src/index.ts`**: Main module export consolidating all shared abstractions
- **`IDebugAdapter`**: Core adapter interface for language implementations
- **`AdapterPolicy`**: Strategy interface for language-specific debugging behaviors
- **`AdapterFactory`**: Base factory class for standardized adapter creation
- **`IAdapterRegistry`**: Registry interface for adapter discovery and management

### Language Integration APIs
- **Policy Implementations**: Language-specific policies (`JsDebugAdapterPolicy`, `PythonAdapterPolicy`, `GoAdapterPolicy`, `RustAdapterPolicy`)
- **Configuration Interfaces**: Generic launch/attach configurations with extension points
- **State Management**: Session lifecycle and execution state tracking through enums and data models

### Debug Entity Models
- **Session Management**: `DebugSession`, `SessionConfig`, `DebugSessionInfo`
- **Debug Artifacts**: `Breakpoint`, `Variable`, `StackFrame`, `DebugLocation`
- **Protocol Types**: Re-exported VSCode Debug Adapter Protocol types for convenience

## Internal Organization and Data Flow

1. **Adapter Discovery**: Registry system locates appropriate adapter factories based on target language
2. **Adapter Instantiation**: Factory pattern validates compatibility and creates language-specific adapters
3. **Session Management**: Dual-state system independently tracks session lifecycle and execution state
4. **Protocol Handling**: Adapters implement DAP operations with language-specific behaviors via policy pattern
5. **Dependency Resolution**: Comprehensive dependency injection enables testing and runtime flexibility

## Critical Design Patterns

- **Strategy Pattern**: Language-specific policies customize debugging behavior within unified interface
- **Factory Pattern**: Standardized adapter creation with semantic versioning and compatibility verification
- **Dependency Injection**: Complete abstraction layer for external services enabling testability
- **Template Method**: Base implementations provide structure while allowing inheritance-based customization
- **Facade Pattern**: Single entry point consolidates complex subsystem interfaces

## Integration Context

This shared package serves as the contract layer between the core MCP Debugger and language-specific implementations, enabling:
- Pluggable debug adapter architecture supporting multiple programming languages
- Type-safe development with comprehensive TypeScript interfaces
- Consistent debugging experience across different language ecosystems
- Testable architecture through dependency injection and comprehensive test coverage
- Future extensibility through factory and policy patterns

The module maintains strict adherence to VSCode Debug Adapter Protocol standards while providing the flexibility required for language-specific debugging requirements and custom extensions.