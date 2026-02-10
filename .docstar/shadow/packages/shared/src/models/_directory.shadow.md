# packages/shared/src/models/
@generated: 2026-02-09T18:16:11Z

## Purpose
This models directory provides the foundational TypeScript type system for multi-language debug session management and Debug Adapter Protocol (DAP) integration. It serves as the core data model layer for a comprehensive debugging framework that supports multiple programming languages with unified session lifecycle management, process attachment, and runtime state tracking.

## Key Components and Architecture

### Core Type System
The module centers around a sophisticated debug session model with three primary architectural pillars:

1. **Dual State Management**: Separates session lifecycle (`SessionLifecycleState`: CREATED → ACTIVE → TERMINATED) from runtime execution state (`ExecutionState`: running, paused, stepping, etc.), providing clear separation of concerns between session existence and runtime behavior.

2. **Universal Process Attachment**: `GenericAttachConfig` provides a language-agnostic interface for attaching to processes via PID, process name, or remote host:port, while `LanguageSpecificAttachConfig` allows adapter-specific extensions through TypeScript index signatures.

3. **Multi-Language Support**: `DebugLanguage` enum enables compile-time type safety across different language debug adapters, including a MOCK language for testing scenarios.

### Data Models and Relationships
- **DebugSession**: Complete session state container with dual state tracking, current location, timestamps, and breakpoint collections
- **DebugSessionInfo**: Lightweight session data optimized for list operations and UI display
- **SessionConfig**: Basic session initialization parameters
- **Runtime Data Types**: `Breakpoint`, `Variable`, `StackFrame`, and `DebugLocation` provide comprehensive debugging context

### Legacy Compatibility Layer
Maintains backward compatibility through deprecated `SessionState` enum with bidirectional migration functions (`mapLegacyState()`, `mapToLegacyState()`), ensuring smooth transitions for existing systems while encouraging adoption of the improved dual-state model.

## Public API Surface

### Primary Entry Points
- **Session Management Types**: `DebugSession`, `DebugSessionInfo`, `SessionConfig`
- **Configuration Interfaces**: `GenericAttachConfig`, `LanguageSpecificAttachConfig`, `CustomLaunchRequestArguments`
- **State Enums**: `SessionLifecycleState`, `ExecutionState`, `DebugLanguage`
- **Runtime Data Types**: `Breakpoint`, `Variable`, `StackFrame`, `DebugLocation`
- **Process Attachment**: `ProcessIdentifierType` enum for attachment method selection

### State Migration Utilities
- `mapLegacyState()`: Legacy to modern state conversion
- `mapToLegacyState()`: Modern to legacy state conversion

## Internal Organization and Data Flow

### State Model Flow
1. Sessions begin in `CREATED` lifecycle state
2. Transition to `ACTIVE` when debug adapter connects
3. Within `ACTIVE` state, execution state tracks runtime behavior
4. Eventually transition to `TERMINATED` lifecycle state

### Configuration Resolution
1. `GenericAttachConfig` provides universal attachment interface
2. Language-specific adapters resolve to `LanguageSpecificAttachConfig`
3. `SessionConfig` combines with resolved configuration for session initialization

## Important Patterns and Conventions

### Type Safety Patterns
- Enum-based language identification for compile-time safety
- Dual state model prevents invalid state combinations
- Optional fields in data structures support incremental updates

### Performance Considerations
- Breakpoints stored as `Map` rather than arrays for O(1) ID-based operations
- Lightweight `DebugSessionInfo` separate from full `DebugSession` for list operations
- Optional `updatedAt` timestamps enable efficient change tracking

### Standards Compliance
Extends VSCode Debug Adapter Protocol types (`@vscode/debugprotocol`) while maintaining compatibility with the broader DAP ecosystem.

## Critical Design Constraints
- `ExecutionState` is only meaningful when `SessionLifecycleState` is `ACTIVE`
- Variable hierarchies support lazy expansion for large data structures
- Source context lines in `DebugLocation` are optional for performance optimization
- Legacy state migration maintains exact semantic equivalence for backward compatibility