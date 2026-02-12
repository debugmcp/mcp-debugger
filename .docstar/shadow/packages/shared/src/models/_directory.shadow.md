# packages/shared/src/models/
@generated: 2026-02-11T23:47:36Z

## Overview

The `models` directory serves as the core type system and data model foundation for debug session management. It provides comprehensive interfaces, enums, and utility functions that define the structure and behavior of debugging operations across multiple programming languages, built on top of the VSCode Debug Adapter Protocol (DAP).

## Key Components and Relationships

**Core Data Models:**
- `DebugSession`: Central session entity that maintains state, execution context, and active breakpoints
- `Breakpoint`: Represents debug breakpoints with verification status and conditional logic
- `CustomLaunchRequestArguments`: Extended launch configuration for debug sessions
- `GenericAttachConfig`: Comprehensive attachment configuration supporting multiple connection modes

**State Management System:**
The directory implements a sophisticated dual-state model that separates session lifecycle from execution state:
- `SessionLifecycleState`: Tracks session existence (CREATED → ACTIVE → TERMINATED)
- `ExecutionState`: Tracks runtime status within active sessions (INITIALIZING → RUNNING/PAUSED → TERMINATED/ERROR)
- Legacy `SessionState` maintained for backward compatibility with mapping functions

**Language and Connection Support:**
- `DebugLanguage`: Defines supported programming languages including mock testing
- `ProcessIdentifierType`: Enables flexible debugger attachment via PID, process name, or remote connection

## Public API Surface

**Primary Entry Points:**
- `DebugSession` interface: Main session data structure
- `GenericAttachConfig` interface: Attachment configuration
- `CustomLaunchRequestArguments` interface: Launch configuration
- State enums: `SessionLifecycleState`, `ExecutionState`, `DebugLanguage`, `ProcessIdentifierType`

**State Management Functions:**
- `mapLegacyState()`: Converts deprecated states to new dual-state model
- `mapToLegacyState()`: Reverse mapping for backward compatibility

## Internal Organization

The module follows a layered architecture:
1. **Protocol Extensions**: Builds upon VSCode Debug Adapter Protocol with custom extensions
2. **Type Definitions**: Language-agnostic interfaces with extension points for specific languages
3. **State Management**: Dual-state system with migration utilities for legacy support
4. **Data Structures**: Efficient storage patterns (Map-based breakpoint storage for O(1) lookups)

## Design Patterns and Conventions

**Language Agnostic Design**: Generic interfaces use index signatures and extension points to accommodate language-specific requirements without coupling to specific debugger implementations.

**Protocol Compliance**: All interfaces extend or align with VSCode Debug Adapter Protocol standards, ensuring interoperability with existing debugging infrastructure.

**State Separation**: Clear separation between session lifecycle (existence) and execution state (runtime status) prevents invalid state combinations and improves debugging logic clarity.

**Backward Compatibility**: Maintains deprecated APIs with explicit migration paths, allowing gradual system updates without breaking existing integrations.

**Extensibility**: Placeholder comments and flexible configuration patterns indicate readiness for future feature additions and language support expansion.