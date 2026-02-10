# packages/shared/src/models/
@generated: 2026-02-10T21:26:17Z

## Purpose
The `packages/shared/src/models` directory provides core data models and type definitions for debug session management in a VS Code Debug Adapter Protocol (DAP) compliant debugger. This module serves as the central type system for representing debug sessions, runtime state, and debugging artifacts across a multi-language debugging platform.

## Key Components and Organization

### Debug Protocol Integration
The module extends VS Code's Debug Adapter Protocol with custom launch configurations (`CustomLaunchRequestArguments`) and comprehensive attach configurations (`GenericAttachConfig`). The `ProcessIdentifierType` enum defines flexible process attachment methods (PID, NAME, REMOTE), enabling diverse debugging scenarios.

### Multi-Language Support
`DebugLanguage` enum establishes support for Python, JavaScript, Java, Rust, Go, and Mock adapters, with the generic configuration system allowing language-specific extensions through TypeScript's index signature pattern.

### Dual State Management Architecture
The module implements a sophisticated dual-state system:
- **Modern Model**: Separates lifecycle (`SessionLifecycleState`) from execution state (`ExecutionState`) for cleaner state transitions
- **Legacy Compatibility**: Maintains `SessionState` enum with bidirectional mapping functions for backward compatibility

This design allows gradual migration while preserving existing integrations.

### Runtime Debug Representation
Core debugging artifacts are modeled through:
- `DebugSession`: Complete session state with dual state tracking and breakpoint management
- `Variable`: Hierarchical variable trees with expandability support
- `StackFrame`: Call stack representation with source location
- `Breakpoint`: Full breakpoint definitions with verification status

## Public API Surface

### Primary Entry Points
- **Session Management**: `DebugSession`, `DebugSessionInfo`, `SessionConfig`
- **State Control**: `SessionLifecycleState`, `ExecutionState`, and legacy mapping functions
- **Runtime Data**: `Variable`, `StackFrame`, `DebugLocation`
- **Configuration**: `GenericAttachConfig`, `CustomLaunchRequestArguments`

### State Transition Utilities
- `mapLegacyState()`: Converts flat legacy states to modern dual-state model
- `mapToLegacyState()`: Provides backward compatibility for legacy consumers

## Internal Data Flow

1. **Session Initialization**: `SessionConfig` → `DebugSession` with CREATED lifecycle state
2. **State Evolution**: Independent tracking of lifecycle (CREATED→ACTIVE→TERMINATED) and execution phases
3. **Runtime Integration**: `Variable` and `StackFrame` populate from DAP responses during active debugging
4. **Breakpoint Management**: Map-based storage enables efficient ID lookups and verification tracking

## Architectural Patterns

- **Type Safety First**: Comprehensive enums and interfaces prevent runtime errors
- **Backward Compatibility**: Dual-state system maintains legacy support during modernization
- **Extensibility**: Generic configurations with language-specific customization points
- **Protocol Compliance**: Strict adherence to VS Code DAP while adding custom extensions

## Critical Design Constraints

- ExecutionState only meaningful when SessionLifecycleState is ACTIVE
- Legacy state mapping must preserve exact behavioral compatibility
- Breakpoint verification status directly affects debugger behavior
- All type definitions must remain DAP-compliant for VS Code integration