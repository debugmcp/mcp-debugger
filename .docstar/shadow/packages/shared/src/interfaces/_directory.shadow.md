# packages/shared/src/interfaces/
@generated: 2026-02-10T21:26:28Z

## Debug Adapter Interface System

**Primary Purpose**: This directory defines the complete interface layer for a multi-language debug adapter system built on the Debug Adapter Protocol (DAP). It provides a pluggable architecture that abstracts language-specific debugging behaviors while maintaining compatibility with VS Code's debugging infrastructure.

## Core Architecture

The system implements a **policy-based adapter architecture** where language-specific behaviors are encapsulated in policy objects that implement common interfaces. This enables the debug transport layer to remain generic while supporting the unique requirements of different debuggers (js-debug, debugpy, CodeLLDB, etc.).

### Key Components and Relationships

**Policy System (`adapter-policy.ts` + language implementations)**:
- `AdapterPolicy` interface defines the contract for language-specific behaviors
- Language policies (Go, Java, JavaScript, Python, Rust, Mock) implement adapter-specific logic
- Handles variable extraction, stack frame filtering, command queueing, and session management
- Coordinates multi-session debugging for languages like JavaScript that spawn child processes

**Registry System (`adapter-registry.ts`)**:
- Factory-based registration and instantiation of debug adapters
- Dependency injection container for adapter services
- Metadata management and adapter discovery
- Lifecycle management with validation and error handling

**Core Adapter Interface (`debug-adapter.ts`)**:
- `IDebugAdapter` - Main abstraction for all language adapters
- Defines lifecycle (initialize, connect, dispose), DAP operations, and configuration transformation
- Event-driven architecture with comprehensive state management
- Feature capability negotiation and environment validation

**Launch Coordination (`adapter-launch-barrier.ts`)**:
- `AdapterLaunchBarrier` interface for synchronizing DAP request/response cycles
- Enables custom launch timing for adapters with complex initialization sequences
- Decouples ProxyManager from adapter-specific launch behavior

### Multi-Session Support

The system provides sophisticated multi-session debugging capabilities:

**DAP Client Behavior (`dap-client-behavior.ts`)**:
- Configures reverse request handling and child session routing
- Manages breakpoint mirroring between parent and child sessions
- Defines command routing strategies for complex debugging scenarios

**Session Strategies**:
- Single-session (Python, Go, Rust) - Traditional debugging model
- Multi-session (JavaScript) - Parent handles configuration, children execute code
- Launch barriers coordinate timing between sessions

### Dependency Injection System

**External Dependencies (`external-dependencies.ts`, `filesystem.ts`, `process-interfaces.ts`)**:
- Comprehensive abstraction layer over Node.js built-ins (fs, child_process, net)
- Enables complete mocking for testing
- Type-safe dependency containers with gradual migration support
- Specialized process launchers for debug targets and proxy processes

## Public API Surface

### Main Entry Points

1. **Adapter Policy Registration**: Language implementers create `AdapterPolicy` objects and register them with the system
2. **Adapter Factory**: `IAdapterFactory` and `IAdapterRegistry` for creating and managing adapter instances
3. **Debug Adapter Interface**: `IDebugAdapter` for implementing language-specific debug adapters
4. **Launch Coordination**: `AdapterLaunchBarrier` for custom launch synchronization

### Language Integration Points

Each language adapter must provide:
- Policy implementation with variable extraction and command handling logic
- Executable resolution and validation
- DAP configuration transformation (launch/attach configs)
- Session management strategy (single vs. multi-session)
- Stack frame filtering and internal code detection

## Data Flow and Coordination

1. **Registration Phase**: Language adapters register policies and factories with the registry
2. **Discovery Phase**: Client queries registry for available languages and capabilities
3. **Instantiation Phase**: Factory creates adapter instance with injected dependencies
4. **Initialization Phase**: Adapter validates environment and establishes DAP connection
5. **Configuration Phase**: Generic configs transformed to language-specific formats
6. **Execution Phase**: DAP requests/responses flow through policy-filtered handlers
7. **Multi-Session Phase**: Child sessions created and coordinated per language strategy

## Key Patterns and Conventions

- **Policy Pattern**: Language behaviors encapsulated in interchangeable policy objects
- **Factory Pattern**: Adapter creation through configurable factories
- **Strategy Pattern**: Pluggable session management and command handling strategies
- **Event-Driven Architecture**: State changes and DAP events propagated through EventEmitter
- **Dependency Injection**: All external dependencies abstracted through interfaces
- **Async-First Design**: All I/O operations return Promises with < 5ms performance targets

## Critical Invariants

- All adapters must emit state change events for proper lifecycle management
- Multi-session adapters must coordinate initialization through launch barriers
- Command queueing policies must prevent DAP protocol violations
- Environment validation is mandatory before debugging operations begin
- Language policies must provide safe defaults for all optional operations

This interface system enables the debug MCP to support multiple programming languages through a unified, extensible architecture while preserving the unique debugging characteristics each language requires.