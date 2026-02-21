# packages\shared\src\models/
@children-hash: e1c596b0bf00f865
@generated: 2026-02-21T08:28:44Z

## Overall Purpose

The `packages/shared/src/models` directory serves as the central data model layer for a multi-language debug session management system. It provides TypeScript interfaces, types, and utilities that extend the VS Code Debug Adapter Protocol (DAP) to support comprehensive debugging across multiple programming languages including Python, JavaScript, Rust, Go, and Mock environments.

## Key Components & Architecture

### Core Data Models
The module is built around several interconnected model categories:

**Session Management**: Complete lifecycle tracking through `DebugSession` and `DebugSessionInfo` interfaces, providing both detailed session state and lightweight listing capabilities.

**Configuration Models**: Language-agnostic debug configuration through `GenericAttachConfig` and `CustomLaunchRequestArguments`, with extensibility points for language-specific options via `LanguageSpecificAttachConfig`.

**State Management**: Dual-state architecture separating session lifecycle (`SessionLifecycleState`) from execution status (`ExecutionState`), with backward compatibility maintained through deprecated `SessionState` and mapping utilities.

**Debug Constructs**: Standard debugging elements including `Breakpoint` with verification tracking, hierarchical `Variable` representations, `StackFrame` with source locations, and `DebugLocation` with contextual line information.

### State Model Evolution
The architecture implements a sophisticated transition from legacy single-state to a modern dual-state model:
- **SessionLifecycleState**: Tracks session existence (CREATED → ACTIVE → TERMINATED)
- **ExecutionState**: Tracks debug execution status (INITIALIZING → RUNNING ⟷ PAUSED → TERMINATED/ERROR)
- Migration functions (`mapLegacyState`, `mapToLegacyState`) ensure backward compatibility

## Public API Surface

**Primary Entry Point**: `index.ts` exports all interfaces and types as the main API surface.

**Key Interfaces for Consumers**:
- `DebugSession`: Complete session state management
- `GenericAttachConfig`/`CustomLaunchRequestArguments`: Debug configuration
- `Breakpoint`, `Variable`, `StackFrame`: Debug runtime constructs
- `DebugLanguage`: Supported language enumeration

**State Management Utilities**:
- Dual-state model types (`SessionLifecycleState`, `ExecutionState`)
- Legacy compatibility functions for state transitions

## Internal Organization & Data Flow

The models follow a hierarchical organization:
1. **Configuration Layer**: Launch/attach parameters and language selection
2. **Session Layer**: Session lifecycle and state management with dual-state tracking
3. **Runtime Layer**: Active debugging constructs (breakpoints, variables, stack frames)
4. **Compatibility Layer**: Legacy state mapping and migration support

Data flows from configuration → session creation → runtime state management, with breakpoints stored as Maps on sessions and variables supporting hierarchical child relationships.

## Design Patterns & Conventions

**Language Agnostic Extension**: Generic base interfaces with `[key: string]: unknown` extension points allow language-specific customization without breaking the common API.

**DAP Compliance**: All interfaces extend or align with VS Code Debug Adapter Protocol types, ensuring standard debugging tool compatibility.

**Backward Compatibility**: Deprecated interfaces are maintained with clear migration paths, allowing gradual system evolution.

**Type Safety**: Strong TypeScript typing throughout with enums for discrete states and comprehensive interface definitions for complex data structures.