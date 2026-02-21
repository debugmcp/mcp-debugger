# packages\shared/
@children-hash: e98ee685e0e3924e
@generated: 2026-02-21T08:29:18Z

## Overall Purpose and Responsibility

The `packages/shared` directory serves as the foundational shared library for the MCP Debugger, providing a comprehensive type-safe abstraction layer that enables multi-language debugging capabilities across JavaScript, Python, Go, Rust, and other languages. This module implements a plugin-based architecture built on the Debug Adapter Protocol (DAP), allowing language-specific debug adapters to integrate seamlessly while maintaining consistent interfaces and behaviors.

## Key Components and Integration

### Core Architecture Components

**Source Library (`src/`)**
- **Interface Abstraction Layer**: Defines primary contracts through `IDebugAdapter`, `IAdapterRegistry`, and `IAdapterFactory`
- **Policy-Driven Architecture**: Implements `AdapterPolicy` for language-specific behaviors with dependency injection support
- **Data Model Foundation**: Extends VS Code DAP with comprehensive session lifecycle management and dual-state architecture
- **Factory Pattern Implementation**: Provides extensible adapter creation with validation and semantic versioning

**Testing Infrastructure (`tests/`)**  
- **Unit Testing Suite**: Comprehensive validation of debug adapter policies for JavaScript and Rust environments
- **Protocol Compliance Testing**: Ensures DAP adherence and cross-platform compatibility
- **Mock-Based Validation**: Simulates file systems, processes, and external dependencies for isolated testing

**Build Configuration (`vitest.config.ts`)**
- **Test Environment Setup**: Configures Vitest with Node.js environment and global test functions
- **Coverage Reporting**: Istanbul-based coverage with multiple output formats
- **Module Resolution**: TypeScript support with path aliases for clean imports

## Component Relationships and Data Flow

The shared module follows a layered architecture pattern:

1. **Configuration Phase**: Generic launch/attach configs are transformed via adapter policies to language-specific formats
2. **Registration**: Factory pattern enables dynamic adapter discovery through the registry system  
3. **Session Management**: Debug sessions track both lifecycle state and execution state through the dual-state model
4. **Runtime Coordination**: Launch barriers synchronize adapter initialization while DAP client behaviors handle multi-session scenarios
5. **Protocol Operations**: Adapters execute DAP commands through policy-defined behaviors with dependency injection
6. **Quality Assurance**: Comprehensive testing validates the entire flow from IDE clients to language debug engines

## Public API Surface

### Primary Entry Points
- **`IDebugAdapter`**: Main contract for implementing language-specific debug support
- **`IAdapterRegistry`**: Central registry for adapter discovery and factory management  
- **`AdapterPolicy`**: Interface for encapsulating language-specific debugging behaviors
- **`DebugSession`**: Complete session state management with lifecycle tracking

### Factory and Creation APIs
- **`IAdapterFactory`** and `AdapterFactory`: Base interfaces and classes for adapter instantiation with validation
- **`IProcessLauncherFactory`**: Process management factory for debug target launching

### Data Models and Configuration
- **Configuration Types**: `GenericAttachConfig`, `CustomLaunchRequestArguments`, `LanguageSpecificAttachConfig`
- **Runtime State Models**: `SessionLifecycleState`, `ExecutionState`, `Breakpoint`, `Variable`, `StackFrame`
- **Language Support**: `DebugLanguage` enum with comprehensive language-specific policy implementations

### Dependency Abstractions
- **`IDependencies`**: Complete dependency injection container
- **Service Interfaces**: `IFileSystem`, `IProcessManager`, `INetworkManager`, `ILogger`, `IServer`

## Internal Organization and Design Patterns

**Strategy Pattern**: Language-specific behaviors are encapsulated in adapter policies, enabling generic core system while accommodating language-specific requirements like Go's Delve debugging or JavaScript's multi-session child process handling.

**Factory Pattern**: Comprehensive factory system with dependency injection and validation supports both built-in and extensible language implementations.

**Dependency Injection**: Complete abstraction of external dependencies enables comprehensive unit testing while maintaining production implementations.

**Event-Driven Architecture**: Debug adapters extend EventEmitter for lifecycle management and DAP event coordination.

**Backward Compatibility**: Legacy state management interfaces with clear migration paths enable gradual system evolution.

## Important Patterns and Conventions

- **Type Safety**: Extensive use of TypeScript for compile-time validation and IntelliSense support
- **Protocol Adherence**: Heavy reliance on `@vscode/debugprotocol` types for DAP compliance
- **Modular Design**: Clear separation between interfaces, models, and implementations
- **Testing Standards**: Mock-based isolation with comprehensive coverage of happy paths and edge cases
- **Cross-Platform Support**: Platform-agnostic abstractions with specific adapter implementations

This shared module serves as the critical foundation enabling the MCP Debugger to support multiple programming languages through a consistent, extensible, and type-safe architecture while maintaining compatibility with standard debugging tools and VS Code's debugging infrastructure.