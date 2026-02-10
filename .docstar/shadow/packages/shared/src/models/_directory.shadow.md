# packages/shared/src/models/
@generated: 2026-02-10T01:19:39Z

## Overview
The `packages/shared/src/models` directory provides the foundational type definitions and data structures for a comprehensive debug session management system. This module serves as the core data layer for VS Code Debug Adapter Protocol (DAP) integration, defining everything from session configuration to runtime debugging state.

## Core Purpose
This module establishes a complete type system for managing debugging sessions across multiple programming languages, with particular focus on:
- Debug session lifecycle and execution state management
- VS Code DAP protocol extensions and customizations
- Multi-language debugging support with flexible configuration
- Backward compatibility during architectural transitions

## Key Components

### Session Configuration & Language Support
- **DebugLanguage enum**: Defines supported debugging targets (Python, JavaScript, Java, Rust, Go, Mock)
- **CustomLaunchRequestArguments**: Extends VS Code DAP with enhanced launch controls
- **GenericAttachConfig**: Flexible attachment configuration supporting PID, process name, and remote connections
- **SessionConfig**: Basic session setup with language and executable specifications

### State Management Architecture
The module implements a sophisticated dual-state system:

**Modern Hierarchical Model:**
- **SessionLifecycleState**: High-level session progression (CREATED → ACTIVE → TERMINATED)  
- **ExecutionState**: Fine-grained execution phases (INITIALIZING → RUNNING → PAUSED → TERMINATED/ERROR)

**Legacy Compatibility Layer:**
- **SessionState**: Deprecated flat state model maintained for backward compatibility
- **State mapping functions**: Bidirectional conversion between legacy and modern state representations

### Runtime Debug Data Structures
- **DebugSession**: Complete session state container with dual state tracking, location info, and breakpoint management
- **Variable**: Hierarchical variable representation supporting expandable object inspection
- **StackFrame**: Call stack frame definitions with source location mapping
- **Breakpoint**: Full breakpoint specification with verification status and conditional logic
- **DebugLocation**: Enhanced location tracking with optional source code context

## Public API Surface
The module exports a comprehensive type system accessible through `index.ts`:
- **Configuration types**: For setting up debug sessions across different languages
- **State enums and interfaces**: For tracking session lifecycle and execution phases
- **Runtime data structures**: For managing active debugging information
- **Utility functions**: For state mapping and compatibility handling

## Internal Organization
The architecture follows these key patterns:
- **Type Safety First**: Comprehensive enums and interfaces ensure compile-time correctness
- **Generic + Extensible**: Base types allow language-specific customizations via index signatures
- **State Evolution**: Maintains strict backward compatibility while enabling modern hierarchical state management
- **Protocol Compliance**: All types align with VS Code DAP specifications while adding custom extensions

## Data Flow
Session management follows a clear progression:
1. **Configuration**: Language selection and connection parameters via SessionConfig/GenericAttachConfig
2. **Lifecycle Management**: State transitions through SessionLifecycleState phases
3. **Execution Tracking**: Fine-grained execution state monitoring when session is active
4. **Runtime Data**: Dynamic collection of variables, stack frames, and breakpoints during debugging
5. **Location Tracking**: Continuous monitoring of execution position with source context

## Critical Design Constraints
- **State Independence**: SessionLifecycleState and ExecutionState operate independently; ExecutionState is only meaningful during ACTIVE lifecycle phase
- **Legacy Compatibility**: State mapping functions must preserve exact behavioral compatibility for existing consumers
- **Protocol Compliance**: All extensions must remain compatible with VS Code DAP specifications
- **Performance Considerations**: Map-based breakpoint storage enables efficient ID-based lookups during active debugging

This module serves as the foundational data contract for the entire debugging system, ensuring type safety and consistency across all debug operations while maintaining flexibility for multi-language support and future extensibility.