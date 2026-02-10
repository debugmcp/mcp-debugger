# packages/shared/src/interfaces/
@generated: 2026-02-09T18:16:19Z

## Primary Purpose
This directory provides the core interface definitions and contracts for a multi-language Debug Adapter Protocol (DAP) framework. It establishes a pluggable architecture that enables language-specific debug adapters to be developed while maintaining a unified API surface for debug session management, process launching, and protocol handling.

## Core Architecture

The interfaces define a layered architecture with three primary concerns:

**Adapter Layer**: Language-specific debugging policies and configurations
- `AdapterPolicy` interface defines adapter-specific behaviors (command queueing, variable extraction, multi-session support)
- Concrete implementations for Go (`adapter-policy-go.ts`), Java (`adapter-policy-java.ts`), JavaScript (`adapter-policy-js.ts`), Python (`adapter-policy-python.ts`), Rust (`adapter-policy-rust.ts`), and Mock (`adapter-policy-mock.ts`)
- `IDebugAdapter` provides the main contract for debug adapters with lifecycle management, DAP operations, and state tracking

**Process Management Layer**: Abstractions for external process interactions
- `process-interfaces.ts` defines high-level process spawning and management contracts
- `external-dependencies.ts` provides dependency injection interfaces for system resources (filesystem, network, logging)
- `filesystem.ts` offers testable filesystem abstraction with mock support

**Protocol Layer**: DAP client behavior and session management
- `dap-client-behavior.ts` configures client-specific DAP behaviors and child session handling
- `adapter-launch-barrier.ts` provides synchronization hooks for adapter startup coordination

## Key Components and Integration

**Language Adapter Ecosystem**: Each adapter policy implements language-specific debugging nuances:
- **Variable handling**: Language-specific scope names and variable filtering (e.g., Python dunder filtering, Go runtime filtering)
- **Multi-session support**: JavaScript supports complex parent-child debugging, while others use single sessions
- **Command queueing**: JavaScript requires strict command ordering, others process immediately
- **Executable resolution**: Platform-aware debugger discovery with environment-specific fallbacks

**Registry and Factory Pattern**: 
- `adapter-registry.ts` provides centralized adapter lifecycle management with factory-based instantiation
- Supports validation, metadata management, and dependency injection
- Enables dynamic adapter discovery and registration

**Process Abstraction**: Multi-tiered process management supporting different use cases:
- `IProcessLauncher`: General process spawning
- `IDebugTargetLauncher`: Python-specific debug target launching with debugpy integration
- `IProxyProcessLauncher`: Session-aware proxy process management

## Public API Surface

**Primary Entry Points**:
- `IDebugAdapter`: Main adapter contract with initialize/dispose lifecycle, DAP operations, and configuration management
- `AdapterPolicy`: Language-specific behavior customization interface
- `IAdapterRegistry`: Centralized adapter management and factory system
- `DapClientBehavior`: Client-side DAP behavior configuration for session management

**Configuration Types**:
- `AdapterConfig`: Complete adapter setup with session, paths, and connection details  
- `GenericLaunchConfig`/`LanguageSpecificLaunchConfig`: Debug session configuration
- `AdapterCapabilities`: DAP capability declaration matching protocol specification

**State Management**:
- `AdapterState`: Standardized adapter lifecycle states (UNINITIALIZED → INITIALIZED → CONNECTED → ERROR)
- `AdapterSpecificState`: Extensible state tracking for adapter-specific properties
- `ValidationResult`: Environment validation with structured error reporting

## Internal Organization and Data Flow

**Initialization Flow**:
1. Registry creates adapters via language-specific factories
2. Adapters validate environment and resolve executable paths
3. Launch barrier coordinates adapter startup timing
4. DAP client behavior configures protocol handling
5. Adapter enters ready state for debugging operations

**Multi-Session Architecture**:
- Parent adapter manages child session creation through `ChildSessionStrategy`
- Command routing can bypass parent for child-specific operations
- Session adoption and pending target management for complex debugging scenarios

**Error Handling**:
- Structured error codes (`AdapterErrorCode`) for environment, connection, protocol, and runtime failures
- `AdapterError` provides recoverability information and user guidance
- Validation results separate errors from warnings with actionable details

## Important Patterns and Conventions

**Dependency Injection**: All external dependencies abstracted through interfaces enabling comprehensive testing and mocking

**Event-Driven Architecture**: Adapters extend EventEmitter with standardized event types for state changes, DAP events, and lifecycle notifications

**Async-First Design**: All operations return Promises with performance constraints (< 5ms per operation)

**Platform Awareness**: Executable resolution handles Windows/macOS/Linux differences with architecture-specific paths

**Graceful Degradation**: Validation and capability checking allow adapters to function with partial feature sets

This interface layer serves as the foundation for language-agnostic debugging support, enabling consistent behavior across different language ecosystems while preserving language-specific optimizations and workflows.