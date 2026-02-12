# packages/shared/src/models/index.ts
@source-hash: 7b495d7251f1ec83
@generated: 2026-02-11T16:13:00Z

Primary purpose: Core data models and type definitions for debug session management, providing interfaces and enums for debugger operations, session state management, and DAP (Debug Adapter Protocol) integration.

## Key Interfaces

**CustomLaunchRequestArguments (L9-13)**: Extends VSCode's DebugProtocol.LaunchRequestArguments with additional debug-specific options (`stopOnEntry`, `justMyCode`). Designed for extensibility with placeholder comment for future arguments.

**GenericAttachConfig (L30-69)**: Comprehensive interface for attaching to debug processes. Supports three attachment modes via `ProcessIdentifierType`: PID-based (L37-38), name-based (L40-41), and remote debugging (L43-47). Includes common debug options like source mapping, timeouts, and environment configuration. Uses index signature for language-specific extensions.

**DebugSession (L218-241)**: Central session data structure containing session metadata, dual state tracking (legacy `state` + new `sessionLifecycle`/`executionState`), current execution context (`currentFile`, `currentLine`), and active breakpoints as a Map.

**Breakpoint (L200-213)**: Represents debug breakpoints with verification status, conditional expressions, and validation messages from DAP adapters.

## Key Enums

**ProcessIdentifierType (L18-25)**: Defines attachment strategies for debuggers - PID, NAME, and REMOTE modes.

**DebugLanguage (L79-85)**: Supported programming languages including MOCK for testing scenarios.

**SessionLifecycleState (L90-97)**: High-level session existence states (CREATED, ACTIVE, TERMINATED).

**ExecutionState (L103-114)**: Detailed execution states within active sessions (INITIALIZING, RUNNING, PAUSED, TERMINATED, ERROR).

**SessionState (L120-135)**: Legacy state enum marked deprecated, maintained for backward compatibility.

## State Management Functions

**mapLegacyState() (L140-156)**: Converts deprecated SessionState values to new dual-state model (SessionLifecycleState + ExecutionState).

**mapToLegacyState() (L161-183)**: Reverse mapping from new state model to legacy SessionState for backward compatibility.

## Dependencies
- `@vscode/debugprotocol`: VSCode Debug Adapter Protocol types (L4)

## Architectural Decisions
- **Dual State Model**: Separates session lifecycle (existence) from execution state (runtime status) for clearer state management
- **Language Agnostic Design**: Generic interfaces with language-specific extension points
- **DAP Integration**: Built on VSCode Debug Adapter Protocol standards
- **Backward Compatibility**: Maintains deprecated SessionState with mapping functions

## Critical Constraints
- ExecutionState only meaningful when SessionLifecycleState is ACTIVE (L101)
- Breakpoints stored as Map for efficient ID-based lookups
- All timestamp fields use Date objects for consistency