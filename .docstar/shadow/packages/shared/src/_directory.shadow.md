# packages\shared\src/
@children-hash: 34bfc72542b18143
@generated: 2026-02-24T01:55:28Z

## Overall Purpose and Responsibility

The `packages/shared/src` directory serves as the foundational contract layer for a multi-language debug adapter system, providing comprehensive TypeScript interfaces, data models, and utilities that enable extensible debugging across Python, JavaScript, Rust, Go, and other languages. This module acts as the central abstraction layer between the Debug Adapter Protocol (DAP) transport mechanism and language-specific debugging implementations.

## Key Components and Architecture

### Core Architectural Layers

**Interface Definitions** (`interfaces/`): Defines the type-safe contract layer implementing policy patterns for language-specific behaviors. Key interfaces include:
- `IDebugAdapter`: Main adapter contract with lifecycle, DAP operations, and configuration transformation
- `AdapterPolicy` with language-specific implementations (Go/Delve, JS/js-debug, Python/debugpy, Rust/CodeLLDB)
- `IAdapterRegistry` and `IAdapterFactory`: Registry pattern for dynamic adapter discovery and management
- External dependency abstractions for filesystem, processes, and networking to enable testing

**Data Models** (`models/`): Comprehensive data model layer extending VS Code DAP with:
- Session management through `DebugSession` and `DebugSessionInfo` interfaces
- Dual-state architecture separating session lifecycle from execution status
- Configuration models supporting generic and language-specific debug parameters
- Runtime constructs including breakpoints, variables, stack frames, and debug locations
- Backward compatibility layer for legacy state management

**Factory Foundation** (`factories/`): Abstract factory pattern implementation ensuring consistent adapter creation across languages:
- `AdapterFactory` base class with template method pattern
- Metadata management and version compatibility validation
- Extensible validation framework with defensive programming patterns

**Central Export Hub** (`index.ts`): Facade pattern providing unified access to all shared abstractions, from core interfaces to utility services and external dependencies.

## Public API Surface and Integration Points

### Primary Entry Points

**Main Module Interface**: The `index.ts` serves as the single entry point, exporting over 200 types, interfaces, and utilities organized into logical groups:
- Debug adapter abstractions and policies
- Session management and data models
- Factory and registry patterns
- External dependency abstractions
- VSCode Debug Protocol re-exports

**Language Adapter Integration**: Language-specific policy implementations allow pluggable behaviors while maintaining unified DAP transport:
- Multi-session coordination for complex debugging scenarios
- Custom initialization sequences and command queueing
- Variable extraction and stack frame filtering
- Child session management and reverse request handling

**Dependency Injection System**: Comprehensive abstraction layer enabling:
- Testable implementations through mock interfaces
- Service composition through `IDependencies` containers
- Cross-platform compatibility through system abstractions

## Internal Organization and Data Flow

### Component Relationships

The architecture follows a layered approach where:

1. **Interfaces Layer** defines contracts and behaviors
2. **Models Layer** provides data structures and state management
3. **Factories Layer** enables consistent instantiation patterns
4. **Index Layer** orchestrates exports and provides unified access

### Key Data Flow Patterns

**Session Lifecycle**: Configuration → Validation → Factory Creation → Policy Application → Runtime State Management
**State Management**: Dual-state model tracking both session lifecycle (CREATED → ACTIVE → TERMINATED) and execution status (RUNNING ⟷ PAUSED)
**Adapter Integration**: Registry → Factory → Policy → Adapter instance with full dependency injection

## Design Patterns and Conventions

**Extensibility Framework**: Language-agnostic base interfaces with extension points enable customization without breaking common APIs
**Type Safety**: Comprehensive TypeScript definitions with runtime validation through type guards
**Backward Compatibility**: Deprecated interfaces maintained with clear migration paths
**DAP Compliance**: All interfaces align with VS Code Debug Adapter Protocol for standard tooling compatibility
**Defensive Programming**: Immutable metadata access, fallback behaviors, and comprehensive error handling

This shared module enables the debug adapter system to support multiple programming languages through a unified, type-safe, and extensible architecture while maintaining strict separation between generic DAP transport logic and language-specific implementation details.