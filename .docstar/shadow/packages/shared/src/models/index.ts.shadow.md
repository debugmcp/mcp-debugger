# packages\shared\src\models\index.ts
@source-hash: 3349ce0316048495
@generated: 2026-02-21T08:28:22Z

## Primary Purpose
Core data models and type definitions for debug sessions, extending the VS Code Debug Adapter Protocol. Provides interfaces for session management, state tracking, breakpoints, and debugging constructs across multiple programming languages.

## Key Interfaces & Types

### Debug Launch & Attach Configuration
- `CustomLaunchRequestArguments` (L9-15): Extends DAP LaunchRequestArguments with custom debug flags (stopOnEntry, justMyCode, console, cwd, env)
- `ProcessIdentifierType` (L20-27): Enum for attach methods - PID, NAME, or REMOTE
- `GenericAttachConfig` (L32-71): Comprehensive attach configuration with process identification, remote debugging, and language-agnostic options
- `LanguageSpecificAttachConfig` (L76): Type alias for language-specific extension properties

### State Management
- `SessionLifecycleState` (L92-99): Session existence states - CREATED, ACTIVE, TERMINATED
- `ExecutionState` (L105-116): Debug execution states - INITIALIZING, RUNNING, PAUSED, TERMINATED, ERROR
- `SessionState` (L122-137): **DEPRECATED** legacy state enum for backward compatibility
- `mapLegacyState()` (L142-158): Converts legacy SessionState to new dual-state model
- `mapToLegacyState()` (L163-185): Converts new state model back to legacy SessionState

### Session & Debug Constructs
- `DebugLanguage` (L81-87): Supported languages enum (Python, JavaScript, Rust, Go, Mock)
- `SessionConfig` (L190-197): Basic session configuration with language and runtime path
- `DebugSession` (L220-243): Complete session state including both legacy and new state models, breakpoints Map, timestamps
- `DebugSessionInfo` (L248-255): Lightweight session info for list operations
- `Breakpoint` (L202-215): Breakpoint definition with verification status and condition support
- `Variable` (L261-272): Variable representation with hierarchical children support
- `StackFrame` (L277-288): Stack frame with source location information
- `DebugLocation` (L293-304): Source location with optional surrounding context lines

## Key Dependencies
- `@vscode/debugprotocol`: VS Code Debug Adapter Protocol types

## Architectural Decisions

### Dual State Model
The codebase implements a transition from a single `SessionState` enum to a dual-state model with `SessionLifecycleState` and `ExecutionState`. This separation distinguishes between session existence (created/active/terminated) and execution status (initializing/running/paused/etc.). Migration functions maintain backward compatibility.

### Language Agnostic Design
Uses generic configurations (`GenericAttachConfig`) with extensibility points (`[key: string]: unknown`) to support language-specific options while maintaining a common interface.

### Breakpoint Management
Breakpoints stored as `Map<string, Breakpoint>` on sessions, supporting verification status and conditional expressions from DAP.

## Critical Invariants
- ExecutionState only meaningful when SessionLifecycleState is ACTIVE
- Legacy SessionState maintained for backward compatibility but new code should use dual-state model
- Breakpoint verification status must be tracked for DAP compliance