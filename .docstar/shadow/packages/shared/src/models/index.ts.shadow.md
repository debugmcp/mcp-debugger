# packages/shared/src/models/index.ts
@source-hash: e8cc72868be7359c
@generated: 2026-02-10T00:41:14Z

## Purpose
TypeScript module defining core data models for debug session management. Provides type definitions for VS Code Debug Adapter Protocol integration, session state management, and debugging runtime data structures.

## Key Types and Interfaces

### Debug Protocol Extensions
- **CustomLaunchRequestArguments** (L9-13): Extends VS Code DAP with `stopOnEntry` and `justMyCode` flags for enhanced launch control
- **ProcessIdentifierType** enum (L18-25): Defines process attachment methods - PID, NAME, or REMOTE connection
- **GenericAttachConfig** (L30-69): Comprehensive attach configuration supporting multiple connection types, source mapping, and extensible language-specific options

### Language and Session Configuration
- **DebugLanguage** enum (L79-86): Supported languages including Python, JavaScript, Java, Rust, Go, and Mock adapter
- **SessionConfig** (L189-196): Basic session configuration with language, name, and optional executable path

### State Management (Dual Model)
**Modern State Model:**
- **SessionLifecycleState** enum (L91-98): CREATED → ACTIVE → TERMINATED lifecycle
- **ExecutionState** enum (L104-115): INITIALIZING → RUNNING → PAUSED → TERMINATED/ERROR execution phases

**Legacy Compatibility:**
- **SessionState** enum (L121-136): @deprecated flat state model for backward compatibility
- **mapLegacyState()** (L141-157): Converts legacy states to modern lifecycle + execution model
- **mapToLegacyState()** (L162-184): Converts modern state back to legacy format

### Core Session Data
- **DebugSession** (L219-242): Complete session state with dual state tracking, location info, timestamps, and breakpoint map
- **DebugSessionInfo** (L247-254): Lightweight session summary for list operations
- **Breakpoint** (L201-214): Full breakpoint definition with verification status and conditions

### Runtime Debug Data
- **Variable** (L260-271): Hierarchical variable representation with expandability support
- **StackFrame** (L276-287): Call stack frame with source location
- **DebugLocation** (L292-303): Enhanced location info with optional source code context

## Dependencies
- `@vscode/debugprotocol`: VS Code Debug Adapter Protocol types for DAP compliance

## Architectural Patterns
- **State Evolution**: Maintains backward compatibility while transitioning from flat to hierarchical state model
- **Generic + Specific**: GenericAttachConfig allows language-specific extensions via index signature
- **Type Safety**: Comprehensive enums and interfaces for all debug operations
- **Runtime Flexibility**: Variable and StackFrame types support dynamic debugging scenarios

## Critical Constraints
- SessionLifecycleState and ExecutionState operate independently - ExecutionState only meaningful when lifecycle is ACTIVE
- Legacy SessionState mapping must maintain exact behavioral compatibility
- Breakpoint verification status affects debugger behavior
- Map-based breakpoint storage enables efficient ID-based lookups