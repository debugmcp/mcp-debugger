# packages/shared/src/
@generated: 2026-02-09T18:16:48Z

## Purpose and Responsibility

The `packages/shared/src` directory serves as the foundational library for the MCP Debugger ecosystem, providing a comprehensive TypeScript framework that enables multi-language debug adapter development and integration. It establishes standardized contracts, type definitions, and architectural patterns that allow language-specific debug adapters to integrate seamlessly with the main debugger through the Debug Adapter Protocol (DAP).

## Core Architecture Components

### Central Type System and Contracts (`index.ts`)
- **Primary API Surface**: Serves as the main entry point exposing all interfaces, types, and utilities needed for debug adapter development
- **Debug Adapter System**: Core `IDebugAdapter` interface and related types defining the primary contract for adapter implementations
- **Registry Pattern**: `IAdapterRegistry` and `IAdapterFactory` interfaces enabling dynamic adapter discovery and lifecycle management
- **External Dependencies Abstraction**: Complete dependency injection framework for system resources (filesystem, process management, networking, logging)

### Interface Layer (`interfaces/`)
- **Language Adapter Policies**: Concrete implementations for each supported language (Go, Java, JavaScript, Python, Rust, Mock) defining language-specific debugging behaviors
- **Process Management**: Multi-tiered process abstraction supporting general spawning, debug target launching, and proxy process management
- **DAP Client Integration**: Protocol-level behavior configuration and session management contracts
- **Validation Framework**: Environment validation and capability checking infrastructure

### Data Models (`models/`)
- **Session Management**: Comprehensive debug session lifecycle with dual state tracking (lifecycle vs execution state)
- **Configuration System**: Universal and language-specific configuration types for launching and attaching to debug targets
- **Runtime Data Structures**: Complete debugging context types (breakpoints, variables, stack frames, locations)
- **Legacy Compatibility**: Migration utilities for backward compatibility with existing systems

### Factory Infrastructure (`factories/`)
- **Abstract Base Classes**: Template method pattern implementation providing common factory behavior
- **Version Management**: Semantic versioning compatibility validation between adapters and core debugger
- **Validation Pipeline**: Extensible validation framework for environment-specific checks
- **Metadata Management**: Immutable factory configuration and capability declaration system

## Key Integration Patterns

### Multi-Language Support Architecture
The system employs a three-tier approach:
1. **Universal Contracts**: Common interfaces and data structures shared across all languages
2. **Policy-Based Customization**: Language-specific behavior encapsulated in dedicated policy classes
3. **Factory-Based Creation**: Standardized adapter instantiation with validation and dependency injection

### State Management Flow
1. **Factory Registration**: Adapters registered through factory pattern with metadata and validation
2. **Session Initialization**: Configuration resolution from generic to language-specific parameters  
3. **Dual State Tracking**: Separate lifecycle state (CREATED → ACTIVE → TERMINATED) and execution state (running, paused, stepping)
4. **Process Integration**: Abstract process management supporting various debugging scenarios

### Dependency Injection Framework
All external dependencies (filesystem, processes, network, logging) are abstracted through interfaces, enabling:
- Comprehensive testing through mocking
- Platform-agnostic implementation
- Clean separation of concerns
- Pluggable service architecture

## Public API Surface

### Main Entry Points
- **`IDebugAdapter`**: Primary contract for debug adapter implementations with lifecycle management and DAP operations
- **`IAdapterRegistry`**: Centralized adapter management and factory system
- **`AdapterPolicy`**: Language-specific behavior customization interface
- **`AdapterFactory`**: Abstract base class for creating language-specific factories
- **`DebugSession`**: Complete session state container with dual state tracking
- **`GenericAttachConfig`**: Universal process attachment interface

### Configuration and Setup Types
- **Debug Session Configuration**: `CustomLaunchRequestArguments`, `GenericAttachConfig`, `SessionConfig`
- **Adapter Configuration**: `AdapterConfig`, `AdapterCapabilities`, `AdapterMetadata`
- **State Management**: `SessionLifecycleState`, `ExecutionState`, `DebugLanguage`

### Runtime and Protocol Types
- **Debug Context**: `Breakpoint`, `Variable`, `StackFrame`, `DebugLocation`
- **DAP Integration**: Re-exports from `@vscode/debugprotocol` with framework-specific extensions
- **Error Handling**: `AdapterError`, `AdapterErrorCode`, `ValidationResult`

## Internal Organization and Data Flow

### Initialization and Registration Flow
1. Language-specific factories register with central registry
2. Factory validation ensures environment compatibility and version requirements
3. Registry creates adapters on-demand through factory pattern
4. Adapters initialize with dependency injection and validation
5. Session creation triggers adapter-specific configuration resolution

### Runtime Operation Flow
1. Debug sessions progress through standardized lifecycle states
2. Language policies customize adapter behavior for specific debugging scenarios
3. Process management abstractions handle target launching and attachment
4. DAP client behavior configures protocol handling and session management
5. Event-driven architecture propagates state changes and debugging events

## Important Patterns and Conventions

### Architectural Patterns
- **Factory Pattern**: Consistent adapter creation with validation and metadata
- **Strategy Pattern**: Language-specific policies encapsulate behavioral differences  
- **Template Method**: Abstract base classes provide common infrastructure
- **Dependency Injection**: All external dependencies abstracted through interfaces
- **Event-Driven**: Adapters extend EventEmitter for state change propagation

### Type Safety and Performance
- **Compile-Time Safety**: Enum-based language identification and state management
- **Tree-Shaking Optimization**: Types and values exported separately
- **Performance Constraints**: < 5ms operation limits with async-first design
- **Memory Efficiency**: Lightweight data structures for list operations, Maps for O(1) lookups

### Standards Compliance
- **DAP Protocol**: Full compatibility with VSCode Debug Adapter Protocol
- **Semantic Versioning**: Version compatibility validation for adapter ecosystems
- **Platform Awareness**: Cross-platform executable resolution and path handling
- **Graceful Degradation**: Partial feature support when full capabilities unavailable

This shared library serves as the foundational layer that enables the MCP Debugger to support multiple programming languages through a unified, extensible architecture while maintaining type safety, performance, and standards compliance across the entire debugging ecosystem.