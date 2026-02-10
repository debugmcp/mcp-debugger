# packages/shared/src/models/index.ts
@source-hash: e8cc72868be7359c
@generated: 2026-02-09T18:14:20Z

## Purpose
Core TypeScript definitions for debug session management and DAP (Debug Adapter Protocol) integration. Provides comprehensive type system for multi-language debugging with state management, configuration interfaces, and legacy compatibility.

## Key Types and Interfaces

### Debug Adapter Protocol Extensions
- **CustomLaunchRequestArguments** (L9-13): Extends VSCode DAP with common debug options (`stopOnEntry`, `justMyCode`)

### Process Attachment
- **ProcessIdentifierType** enum (L18-25): Defines attachment methods - PID, process name, or remote host:port
- **GenericAttachConfig** (L30-69): Universal attach configuration supporting all identifier types, with extensible language-specific options via index signature
- **LanguageSpecificAttachConfig** (L74): Type alias for adapter-resolved configurations

### Language and State Management
- **DebugLanguage** enum (L79-86): Supported languages including MOCK for testing
- **SessionLifecycleState** enum (L91-98): Session existence states (CREATED → ACTIVE → TERMINATED)
- **ExecutionState** enum (L104-115): Runtime execution states within active sessions
- **SessionState** enum (L121-136): **DEPRECATED** legacy state model for backward compatibility

### State Migration Functions
- **mapLegacyState()** (L141-157): Converts legacy SessionState to new dual-state model
- **mapToLegacyState()** (L162-184): Reverse conversion for legacy system compatibility

### Session Configuration and Data
- **SessionConfig** (L189-196): Basic session setup with language, name, and optional runtime path
- **DebugSession** (L219-242): Complete session state including dual state tracking, current location, timestamps, and breakpoint Map
- **DebugSessionInfo** (L247-254): Lightweight session data for list operations

### Debug Runtime Data
- **Breakpoint** (L201-214): Breakpoint definition with verification status and DAP validation messages
- **Variable** (L260-271): Hierarchical variable representation with expandable children
- **StackFrame** (L276-287): Call stack frame with source location
- **DebugLocation** (L292-303): Enhanced location info with optional source context lines

## Architectural Patterns

### Dual State Model
Uses separate lifecycle and execution states to clearly distinguish session existence from runtime status. Legacy state enum maintained for backward compatibility with migration functions.

### Generic + Specific Configuration
GenericAttachConfig provides universal attach interface while LanguageSpecificAttachConfig allows adapter-specific extensions through index signatures.

### Type-Safe Language Support
Enum-based language identification enables compile-time safety for multi-language debug adapters.

## Dependencies
- `@vscode/debugprotocol`: VSCode Debug Adapter Protocol types for standards compliance

## Critical Constraints
- ExecutionState only meaningful when SessionLifecycleState is ACTIVE
- Map data structure used for breakpoints (not array) for efficient ID-based operations
- Optional updatedAt in DebugSessionInfo suggests different usage patterns vs full DebugSession