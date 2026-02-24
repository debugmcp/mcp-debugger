# packages\shared\src\interfaces/
@children-hash: a072957d370984f6
@generated: 2026-02-24T01:55:08Z

## Overview

The `interfaces` directory defines the type-safe contract layer for the debug adapter system, providing comprehensive interface definitions that enable pluggable, language-specific debugging implementations while maintaining a unified Debug Adapter Protocol (DAP) abstraction.

## Core Architecture

This directory implements a **policy pattern** architecture where language-specific debugging behaviors are abstracted through interfaces, allowing the core DAP transport layer to remain generic while accommodating adapter-specific quirks like multi-session debugging, initialization sequences, and command queueing.

### Key Interface Categories

**Adapter Policy System** (`adapter-policy.ts`, `adapter-policy-*.ts`):
- `AdapterPolicy` interface defines the contract for language-specific behaviors
- Concrete implementations for Go (Delve), JavaScript (js-debug), Python (debugpy), Rust (CodeLLDB), and mock testing
- Handles multi-session coordination, variable extraction, stack frame filtering, and adapter-specific initialization requirements
- Supports complex features like child session management and reverse `startDebugging` requests

**Debug Adapter Abstraction** (`debug-adapter.ts`):
- `IDebugAdapter` interface provides the main contract for debug adapter implementations
- Defines lifecycle management, DAP protocol operations, configuration transformation, and feature capabilities
- Supports async configuration transformation (added in v2.1.0) for build operations
- Includes comprehensive error handling with categorized error codes and validation results

**Registry and Factory Pattern** (`adapter-registry.ts`):
- `IAdapterRegistry` and `IAdapterFactory` interfaces enable dynamic adapter discovery and instantiation
- Supports dependency injection, metadata querying, and validation
- Provides centralized management of multiple language adapters with lifecycle tracking

**Multi-Session Coordination** (`adapter-launch-barrier.ts`, `dap-client-behavior.ts`):
- `AdapterLaunchBarrier` interface enables custom launch coordination between ProxyManager and adapters
- `DapClientBehavior` interface configures reverse request handling, child session routing, and breakpoint mirroring
- Supports complex debugging scenarios like JavaScript multi-target debugging

## External Dependencies and Mocking

**Dependency Injection Layer** (`external-dependencies.ts`, `filesystem.ts`, `process-interfaces.ts`):
- Comprehensive abstractions over Node.js APIs (filesystem, child processes, networking)
- Enables testing through mock implementations
- Provides type-safe dependency injection containers
- Supports both high-level domain operations and low-level system access

## Integration Patterns

The interfaces work together through several key patterns:

1. **Strategy Pattern**: `AdapterPolicy` implementations allow pluggable language-specific behaviors
2. **Factory Pattern**: Registry and factory interfaces enable dynamic adapter creation
3. **Dependency Injection**: External dependencies are abstracted for testability
4. **Observer Pattern**: Event-driven architecture through EventEmitter-based interfaces

## Public API Surface

**Main Entry Points**:
- `IDebugAdapter` - Primary adapter interface for implementing language support
- `AdapterPolicy` - Policy interface for customizing adapter behaviors
- `IAdapterRegistry` - Central registry for managing multiple adapters
- `DapClientBehavior` - Configuration for DAP client behaviors and multi-session support

**Language-Specific Policies**:
- `GoAdapterPolicy` - Delve debugger integration
- `JsDebugAdapterPolicy` - VS Code js-debug multi-session support
- `PythonAdapterPolicy` - debugpy integration with Windows Store detection
- `RustAdapterPolicy` - CodeLLDB integration

**Utility Interfaces**:
- External dependency abstractions for filesystem, processes, networking
- Error handling types with recovery strategies
- State management and lifecycle interfaces

This directory serves as the foundational contract layer that enables the debug adapter system to support multiple programming languages through a unified, extensible architecture while maintaining strict separation between generic DAP transport logic and language-specific implementation details.