# packages\shared\src\models/
@children-hash: 2a5d792935b4036c
@generated: 2026-02-15T09:01:24Z

## Overall Purpose

The `packages/shared/src/models` directory serves as the central type definition hub for a debug session management system. It provides core data models, interfaces, and enums that enable standardized debugging operations across multiple programming languages through the Debug Adapter Protocol (DAP).

## Key Components and Relationships

### Core Data Models
- **DebugSession**: The central data structure that orchestrates all debugging activities, maintaining session metadata, dual-state tracking, execution context (current file/line), and active breakpoints
- **Breakpoint**: Represents debug breakpoints with verification status and conditional logic support
- **GenericAttachConfig**: Comprehensive configuration interface supporting three attachment modes (PID, process name, remote debugging)
- **CustomLaunchRequestArguments**: Extends VSCode's launch arguments with debug-specific options

### State Management System
The module implements a sophisticated dual-state model:
- **SessionLifecycleState**: Tracks session existence (CREATED → ACTIVE → TERMINATED)
- **ExecutionState**: Manages runtime status within active sessions (INITIALIZING → RUNNING → PAUSED → TERMINATED/ERROR)
- **Legacy Support**: Maintains backward compatibility through SessionState enum and bidirectional mapping functions

### Language and Process Support
- **DebugLanguage enum**: Defines supported programming languages including a MOCK mode for testing
- **ProcessIdentifierType enum**: Enables flexible debugger attachment strategies (PID, name-based, remote)

## Public API Surface

### Main Entry Points
- **DebugSession interface**: Primary session management contract
- **GenericAttachConfig interface**: Standard attachment configuration
- **State management functions**: `mapLegacyState()` and `mapToLegacyState()` for state transitions
- **All enums**: ProcessIdentifierType, DebugLanguage, SessionLifecycleState, ExecutionState, SessionState (deprecated)

### Extension Points
- GenericAttachConfig uses index signatures to allow language-specific extensions
- CustomLaunchRequestArguments designed for future argument additions

## Internal Organization and Data Flow

1. **Session Initialization**: DebugSession created with initial lifecycle state
2. **Attachment/Launch**: GenericAttachConfig or CustomLaunchRequestArguments specify connection method
3. **State Transitions**: Dual-state model tracks both session existence and execution status
4. **Breakpoint Management**: Map-based storage for efficient breakpoint operations
5. **Legacy Compatibility**: Mapping functions bridge old and new state models

## Important Patterns and Conventions

- **DAP Integration**: Built on VSCode Debug Adapter Protocol standards for interoperability
- **Language Agnostic Design**: Generic interfaces with specific language extension capabilities
- **Efficient Data Structures**: Uses Map for breakpoint storage to enable O(1) ID-based lookups
- **Type Safety**: Comprehensive TypeScript interfaces with clear constraints (e.g., ExecutionState only valid when SessionLifecycleState is ACTIVE)
- **Temporal Consistency**: All timestamp fields standardized on Date objects

## Dependencies
- `@vscode/debugprotocol`: Provides foundation DAP types for VSCode integration

This module forms the foundational layer for any debugging system requiring multi-language support, flexible attachment strategies, and robust state management with backward compatibility guarantees.