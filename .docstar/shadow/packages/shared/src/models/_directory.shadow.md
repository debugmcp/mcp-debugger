# packages\shared\src\models/
@generated: 2026-02-12T21:05:44Z

## Purpose and Responsibility

The `packages/shared/src/models` directory contains the core data models and type definitions for a debug session management system. This module provides a comprehensive type-safe foundation for building debugger applications that integrate with the VSCode Debug Adapter Protocol (DAP). It serves as the central data contract layer for debug operations, session state management, and multi-language debugging support.

## Key Components and Relationships

### Core Data Structures
- **DebugSession**: The central entity that encapsulates all session-related data including metadata, state tracking, execution context, and active breakpoints
- **Breakpoint**: Represents debug breakpoints with DAP verification status and conditional logic
- **CustomLaunchRequestArguments**: Extends VSCode's launch configuration with additional debug-specific options
- **GenericAttachConfig**: Comprehensive configuration interface supporting multiple attachment strategies (PID, name-based, remote)

### State Management Architecture
The module implements a sophisticated dual-state model that separates concerns:
- **SessionLifecycleState**: Manages high-level session existence (CREATED → ACTIVE → TERMINATED)
- **ExecutionState**: Tracks detailed runtime status within active sessions (INITIALIZING → RUNNING → PAUSED)
- **Legacy Support**: Maintains backward compatibility through SessionState enum with bidirectional mapping functions

### Language and Process Support
- **DebugLanguage**: Enumeration of supported programming languages with MOCK support for testing
- **ProcessIdentifierType**: Defines three attachment strategies for connecting to target processes

## Public API Surface

### Main Entry Points
- **DebugSession interface**: Primary data structure for session management
- **Breakpoint interface**: Standard breakpoint representation
- **Configuration interfaces**: CustomLaunchRequestArguments and GenericAttachConfig for debug setup
- **State enums**: SessionLifecycleState, ExecutionState, DebugLanguage, ProcessIdentifierType

### State Transition Functions
- **mapLegacyState()**: Converts deprecated SessionState to new dual-state model
- **mapToLegacyState()**: Provides backward compatibility by mapping new states to legacy format

## Internal Organization and Data Flow

The module follows a layered architecture:
1. **Base Types Layer**: Fundamental enums and type definitions
2. **Configuration Layer**: Launch and attach configuration interfaces
3. **Runtime Layer**: Session and breakpoint data structures
4. **Compatibility Layer**: Legacy state mapping functions

Data flows from configuration (launch/attach) → session creation → state management → execution tracking, with breakpoints maintained as efficient Map structures for ID-based lookups.

## Important Patterns and Conventions

### Design Principles
- **Language Agnostic**: Generic interfaces with extension points for language-specific customization
- **DAP Compliance**: Built on VSCode Debug Adapter Protocol standards for broad compatibility
- **Type Safety**: Comprehensive TypeScript interfaces with strict typing
- **State Separation**: Clear distinction between session lifecycle and execution state
- **Extensibility**: Index signatures and placeholder comments for future enhancements

### Critical Constraints
- ExecutionState is only meaningful when SessionLifecycleState is ACTIVE
- All timestamp fields consistently use Date objects
- Breakpoints use Map data structure for efficient operations
- State transitions follow defined patterns to maintain consistency

This module serves as the foundational data layer that enables robust, type-safe debug session management across multiple programming languages and debugging scenarios.