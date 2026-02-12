# packages/shared/src/interfaces/
@generated: 2026-02-11T23:47:48Z

## Purpose and Responsibility

The `packages/shared/src/interfaces` directory defines the core interface contracts and type system for a multi-language debug adapter framework. This module establishes the architectural boundaries between different components of the debugging system, enabling language-specific adapters (JavaScript, Python, Go, Rust, Mock) to integrate with a unified DAP (Debug Adapter Protocol) client through well-defined abstractions.

## Key Components and Architecture

### Adapter Policy System
The adapter policy framework (`adapter-policy.ts`) serves as the central abstraction, with language-specific implementations (`adapter-policy-*.ts`) providing customized behaviors:

- **Core Interface**: `AdapterPolicy` defines the contract for session management, command handling, variable extraction, and initialization behaviors
- **Language Implementations**: JavaScript (`js.ts`), Python (`python.ts`), Go (`go.ts`), Rust (`rust.ts`), and Mock (`mock.ts`) adapters each implement specific debugging behaviors
- **Multi-Session Support**: JavaScript adapter supports complex child session strategies, while others use single-session models
- **Command Queueing**: Language-specific command ordering and state management (JavaScript requires strict handshake sequencing, others process immediately)

### Debug Adapter Abstraction
The `debug-adapter.ts` interface defines the core `IDebugAdapter` contract that all language adapters must implement:

- **Lifecycle Management**: Initialize, connect, debug, disconnect, dispose states
- **DAP Protocol Operations**: Send requests, handle events/responses with typed interfaces
- **Configuration Transformation**: Convert generic launch configs to language-specific formats
- **Feature Capabilities**: Declare supported debugging features through comprehensive capability flags

### DAP Client Behavior Framework
The `dap-client-behavior.ts` interface enables customization of reverse request handling, child session management, and adapter-specific client behaviors without modifying core DAP transport logic.

### Dependency Injection System
Multiple interface files establish testable abstractions:

- **External Dependencies** (`external-dependencies.ts`): File system, process management, networking, logging
- **Process Management** (`process-interfaces.ts`): High-level process launching with debug-specific abstractions
- **Filesystem** (`filesystem.ts`): Basic file operations with error-safe defaults

### Registry and Factory Patterns
- **Adapter Registry** (`adapter-registry.ts`): Centralized adapter management with factory-based instantiation
- **Launch Coordination** (`adapter-launch-barrier.ts`): Synchronization primitive for custom DAP request handling

## Public API Surface

### Primary Entry Points
- `IDebugAdapter`: Core adapter interface that language implementations must satisfy
- `AdapterPolicy`: Strategy interface for language-specific debugging behaviors
- `DapClientBehavior`: Configuration interface for customizing DAP client behaviors
- `IAdapterRegistry`: Registry interface for managing and creating debug adapters

### Language-Specific Policies
- `JsDebugAdapterPolicy`: JavaScript/Node.js debugging with multi-session support
- `PythonAdapterPolicy`: Python debugpy integration with executable validation
- `GoAdapterPolicy`: Go Delve integration with variable filtering
- `RustAdapterPolicy`: Rust CodeLLDB integration with compilation support
- `MockAdapterPolicy`: Testing implementation with minimal functionality

### Factory Interfaces
- `IAdapterFactory`: Creates adapter instances with dependency injection
- `IProcessLauncherFactory`: Creates specialized process launchers
- `IProxyManagerFactory`: Creates proxy managers for adapter communication

## Internal Organization and Data Flow

1. **Adapter Selection**: Registry matches commands to appropriate language policies
2. **Initialization**: Adapters validate environment and resolve executables
3. **Configuration**: Transform generic configs to language-specific formats
4. **Connection**: Establish DAP protocol connection with language-specific handshakes
5. **Session Management**: Handle single or multi-session debugging based on adapter policy
6. **Command Processing**: Route commands through language-specific queueing and filtering
7. **Event Handling**: Process DAP events with adapter-specific behaviors
8. **Cleanup**: Dispose resources and terminate processes

## Important Patterns and Conventions

### Strategy Pattern
Language adapters implement the `AdapterPolicy` interface to provide customized behaviors while keeping the core DAP transport generic.

### Factory Pattern  
Registry and factory interfaces enable dependency injection and facilitate testing by allowing mock implementations.

### Event-Driven Architecture
All adapters extend EventEmitter for state changes and DAP event propagation.

### Async-First Design
All I/O operations return Promises with < 5ms performance constraints for responsiveness.

### Error Safety
Interfaces prefer graceful degradation with safe defaults rather than throwing exceptions, especially in filesystem and process operations.

### Type Safety
Comprehensive TypeScript interfaces with generic type parameters for DAP protocol type safety and language-specific configuration typing.

This interface layer enables the debugging framework to support multiple programming languages through a unified architecture while allowing each language adapter to implement its specific requirements and optimizations.