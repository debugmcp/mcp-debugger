# packages/shared/src/
@generated: 2026-02-10T01:20:26Z

## Overall Purpose and Responsibility

The `packages/shared/src` directory serves as the foundational shared library for a multi-language debug adapter framework built on the VS Code Debug Adapter Protocol (DAP). This module provides the complete type system, interfaces, factories, and models that enable language-agnostic debugging while supporting language-specific customizations through a sophisticated policy-based architecture.

## Key Components and Integration

### Core Architecture Layers

**Type System and Contracts (`interfaces/`)**
- **IDebugAdapter**: Primary interface defining the debug adapter contract with async configuration, validation, and state management
- **AdapterPolicy**: Strategy pattern interface enabling language-specific debugging behaviors (variable extraction, command queueing, multi-session handling)
- **IAdapterRegistry**: Factory-based registry system for managing multiple debug adapter types
- **Infrastructure Abstractions**: Dependency injection interfaces for file system, process management, networking, and logging

**Factory System (`factories/`)**
- **AdapterFactory**: Abstract base class enforcing consistent adapter instantiation patterns
- **Metadata Management**: Standardized adapter metadata with immutability guarantees
- **Version Compatibility**: Semantic version checking for core debugger compatibility
- **Validation Framework**: Extensible validation system with graceful defaults

**Data Models (`models/`)**
- **Session Management**: Complete debug session lifecycle with dual-state tracking (SessionLifecycleState + ExecutionState)
- **Debug Structures**: Runtime data types for variables, stack frames, breakpoints, and locations
- **Configuration Types**: Launch and attach configurations supporting multiple languages
- **Legacy Compatibility**: State mapping functions maintaining backward compatibility

**Central Export Hub (`index.ts`)**
Orchestrates all components into a cohesive API surface organized by functional areas: debug adapters, registries, dependencies, process management, models, factories, policies, and external protocol support.

### Integration Patterns

**Policy-Driven Language Support**
Language-specific adapter policies (Go, Java, JavaScript, Python, Rust, Mock) customize debugging behavior without modifying core infrastructure:
- JavaScript: Complex multi-session coordination with parent/child session routing
- Python: Windows Store detection and virtual environment handling
- Go: Runtime frame filtering and goroutine management
- Java: Classpath resolution and JVM integration

**Dependency Injection Architecture**
All external dependencies flow through well-defined interfaces, enabling:
- Comprehensive unit testing with mock implementations
- Platform adaptation (Node.js defaults with pluggable alternatives)
- Clean separation between debug logic and system resources

**State Management Evolution**
Dual-state system supports both modern hierarchical state tracking and legacy flat state models:
- Modern: SessionLifecycleState (CREATED → ACTIVE → TERMINATED) + ExecutionState (INITIALIZING → RUNNING → PAUSED)
- Legacy: Deprecated SessionState with bidirectional mapping functions

## Public API Surface

### Primary Entry Points

**Debug Adapter Integration**
- `IDebugAdapter`: Main interface for implementing language-specific debug adapters
- `AdapterFactory`: Base class for creating adapter factories with validation and compatibility
- `IAdapterRegistry`: Registry for managing adapter discovery and instantiation

**Language-Specific Policies**
- Pre-built adapter policies: `GoAdapterPolicy`, `JavaAdapterPolicy`, `JavaScriptAdapterPolicy`, `PythonAdapterPolicy`, `RustAdapterPolicy`, `MockAdapterPolicy`
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

**Multi-Language Debugging**
- `DebugLanguage` enum defining supported languages
- Generic configuration types with language-specific transformations
- Consistent validation and error handling across all languages

## Internal Organization and Data Flow

### Adapter Lifecycle
1. **Registration**: Language adapters register via `IAdapterFactory` implementations in the registry
2. **Discovery**: Registry matches adapter policies based on command patterns and language detection  
3. **Instantiation**: Factory creates adapter instances with proper dependency injection
4. **Validation**: Async validation and version compatibility checks before activation
5. **State Management**: Adapters transition through defined states with event emission
6. **Configuration**: Generic configs transform to language-specific formats via policies

### Command Processing Pipeline
1. **Policy Selection**: Commands route through language-specific adapter policies
2. **State Gating**: Command queueing enforces proper initialization sequences
3. **Multi-Session Coordination**: Complex debugging scenarios (like JavaScript) coordinate multiple DAP sessions
4. **Protocol Translation**: Generic operations translate to language-specific debug commands

### Error Handling and Resilience
- Comprehensive error taxonomy with typed error codes (`AdapterError`, `AdapterErrorCode`)
- Graceful degradation with safe defaults rather than exception propagation
- Validation framework with permissive defaults favoring operation success
- Backward compatibility maintenance through state mapping functions

This shared library provides the foundational infrastructure enabling robust, testable, and extensible multi-language debugging while maintaining clean architectural boundaries and comprehensive type safety throughout the debug ecosystem.