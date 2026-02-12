# packages\shared\src\models/
@generated: 2026-02-12T21:00:54Z

## Overall Purpose

The `packages/shared/src/models` directory serves as the central data modeling layer for a cross-platform debug session management system. It provides comprehensive type definitions, interfaces, and state management utilities that abstract debug operations across multiple programming languages while maintaining compatibility with the VSCode Debug Adapter Protocol (DAP).

## Key Components and Relationships

The module is organized around three primary concerns:

**Configuration Models**: `CustomLaunchRequestArguments` and `GenericAttachConfig` define how debug sessions are initiated. The attach configuration supports multiple connection strategies (PID, process name, remote debugging) through the `ProcessIdentifierType` enum, while the launch configuration extends VSCode's standard launch arguments with debug-specific options.

**Session State Management**: A sophisticated dual-state system separates session lifecycle concerns from execution state. `SessionLifecycleState` tracks whether a session exists (CREATED, ACTIVE, TERMINATED), while `ExecutionState` manages runtime status (INITIALIZING, RUNNING, PAUSED, etc.). Legacy `SessionState` is maintained for backward compatibility with bidirectional mapping functions.

**Runtime Data Structures**: `DebugSession` acts as the central session container, holding metadata, state information, execution context, and active breakpoints. `Breakpoint` models individual breakpoints with DAP verification status and conditional logic support.

**Language Abstraction**: `DebugLanguage` enum defines supported programming languages, with MOCK for testing scenarios, enabling language-agnostic tooling with extension points for language-specific behaviors.

## Public API Surface

**Primary Entry Points**:
- `CustomLaunchRequestArguments` - Launch configuration interface
- `GenericAttachConfig` - Attach configuration with multi-modal connection support
- `DebugSession` - Core session data structure
- `Breakpoint` - Breakpoint representation with DAP integration

**State Management API**:
- `SessionLifecycleState`, `ExecutionState` - Modern dual-state enums
- `mapLegacyState()`, `mapToLegacyState()` - State conversion utilities for backward compatibility

**Supporting Types**:
- `ProcessIdentifierType` - Attachment strategy enumeration
- `DebugLanguage` - Supported language definitions

## Internal Organization and Data Flow

The module follows a layered architecture:
1. **Configuration Layer**: Defines session initiation parameters
2. **State Management Layer**: Handles session lifecycle and execution state transitions
3. **Data Layer**: Manages runtime session data and breakpoint information
4. **Compatibility Layer**: Provides legacy state mapping for backward compatibility

Data flows from configuration (launch/attach) → session creation → state transitions → runtime data management, with the `DebugSession` serving as the primary data container throughout the lifecycle.

## Important Patterns and Conventions

**Extensibility Pattern**: Interfaces use index signatures and placeholder comments to support future language-specific extensions without breaking changes.

**State Separation**: Critical architectural decision to separate lifecycle state from execution state, ensuring clarity about when execution states are valid (only during ACTIVE lifecycle state).

**DAP Integration**: All models are designed to integrate seamlessly with VSCode Debug Adapter Protocol, using standard DAP types and conventions.

**Backward Compatibility**: Maintains deprecated APIs with explicit mapping functions, allowing gradual migration to new state models without breaking existing integrations.

**Type Safety**: Comprehensive TypeScript definitions ensure compile-time validation of debug configurations and session data structures.