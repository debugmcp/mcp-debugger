# packages\shared\src\interfaces/
@generated: 2026-02-12T21:05:55Z

## Purpose

The `packages/shared/src/interfaces` directory defines the core contract layer for a multi-language debug adapter system. It provides TypeScript interfaces and types that establish the architecture for Debug Adapter Protocol (DAP) communication, language-specific adapter policies, and dependency injection across the entire debugging framework.

## Architecture Overview

This directory implements a **policy-based debugging architecture** that decouples language-specific behaviors from the core DAP transport mechanism. The interfaces enable:

- **Language-agnostic DAP transport** with pluggable language-specific policies
- **Multi-session debugging support** with parent-child session coordination
- **Comprehensive dependency injection** for testing and modularity
- **Adapter lifecycle management** with standardized initialization sequences

## Core Components & Relationships

### Debug Adapter Foundation
- **`debug-adapter.ts`** - Main `IDebugAdapter` interface defining the complete adapter contract (lifecycle, DAP operations, configuration transformation)
- **`adapter-policy.ts`** - `AdapterPolicy` interface for language-specific behaviors and the strategy pattern implementation
- **`adapter-registry.ts`** - Factory-based registry system (`IAdapterRegistry`, `IAdapterFactory`) for adapter discovery and instantiation

### Language-Specific Policies
- **`adapter-policy-js.ts`** - JavaScript/Node.js policy with multi-session child spawning and strict handshake requirements
- **`adapter-policy-python.ts`** - Python/debugpy policy with executable validation and variable filtering
- **`adapter-policy-go.ts`** - Go/Delve policy with goroutine handling and runtime frame filtering  
- **`adapter-policy-rust.ts`** - Rust/CodeLLDB policy with compilation support and platform-specific configuration
- **`adapter-policy-mock.ts`** - Testing mock policy with minimal behaviors

### Multi-Session Coordination
- **`dap-client-behavior.ts`** - `DapClientBehavior` interface defining reverse request handling, child session routing, and breakpoint mirroring strategies
- **`adapter-launch-barrier.ts`** - `AdapterLaunchBarrier` interface for custom DAP request coordination between proxy managers and adapters

### Dependency Injection Layer
- **`external-dependencies.ts`** - Complete dependency container (`IDependencies`) with abstractions for filesystem, process management, networking, and logging
- **`filesystem.ts`** - `FileSystem` interface with production `NodeFileSystem` implementation
- **`process-interfaces.ts`** - Process abstraction interfaces (`IProcessLauncher`, `IDebugTarget`, `IProxyProcess`) for testable process management

## Key Entry Points & Public API

### Primary Interfaces
- `IDebugAdapter` - Main adapter contract for language implementations
- `AdapterPolicy` - Strategy interface for language-specific behaviors
- `IAdapterRegistry` - Central adapter discovery and creation
- `DapClientBehavior` - Multi-session coordination configuration

### Factory Patterns
- `IAdapterFactory` - Creates debug adapter instances with dependency injection
- `IProcessLauncherFactory` - Creates specialized process launchers
- `ILoggerFactory` - Creates named logger instances

### Configuration Types
- `AdapterConfig` - Adapter launch configuration
- `GenericLaunchConfig` / `LanguageSpecificLaunchConfig` - Debugging session configuration
- `AdapterCapabilities` - DAP feature support declaration

## Internal Organization & Data Flow

### Adapter Selection Flow
1. **Registry Discovery** - `IAdapterRegistry` matches language to factory
2. **Factory Validation** - `IAdapterFactory.validate()` checks environment 
3. **Instance Creation** - Factory creates `IDebugAdapter` with injected dependencies
4. **Policy Application** - Adapter uses `AdapterPolicy` for language-specific behaviors

### Debug Session Lifecycle
1. **Initialization** - `IDebugAdapter.initialize()` validates environment
2. **Configuration** - Transform generic to language-specific config via `transformLaunchConfig()`
3. **Connection** - Establish DAP connection through `connect()`
4. **Multi-session Coordination** - Use `DapClientBehavior` and `AdapterLaunchBarrier` for child sessions
5. **Protocol Operations** - `sendDapRequest()` / `handleDapEvent()` / `handleDapResponse()`

### Policy-Based Customization
Each language adapter implements `AdapterPolicy` to customize:
- **Command queuing** - Whether to queue commands during initialization
- **Variable extraction** - Language-specific local variable filtering
- **Stack frame filtering** - Hide internal/framework frames
- **Child session strategies** - How to spawn and manage child debugging sessions
- **Executable resolution** - Platform-specific debugger executable discovery

## Critical Patterns

### Strategy Pattern
`AdapterPolicy` implementations (JS, Python, Go, Rust, Mock) provide language-specific behaviors while keeping the core DAP transport generic.

### Factory Pattern  
`IAdapterRegistry` and `IAdapterFactory` enable dynamic adapter creation with proper dependency injection and environment validation.

### Dependency Injection
`IDependencies` container enables complete mocking for tests while providing production implementations through interfaces like `IFileSystem`, `IProcessLauncher`, etc.

### Event-Driven Architecture
All adapters extend `EventEmitter` for state changes, DAP events, and lifecycle notifications, enabling reactive debugging workflows.

This interface layer provides the foundational contracts that enable the debug adapter system to support multiple programming languages through a unified, extensible, and testable architecture.