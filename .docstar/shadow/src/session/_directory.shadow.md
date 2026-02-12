# src/session/
@generated: 2026-02-11T23:47:43Z

## Session Management Module

**Primary Purpose**: Complete debug session management system that provides centralized control over debug adapter lifecycle, state management, and debugging operations through a layered architecture with separation of concerns.

## Core Architecture

The module follows a hierarchical composition pattern with four distinct layers:

1. **SessionStore** - Pure data layer for session storage and lifecycle management
2. **SessionManagerCore** - Abstract base providing event handling, state transitions, and dependency injection
3. **SessionManagerData** - Data retrieval operations for variables, stack traces, and scopes
4. **SessionManagerOperations** - Complete debugging operations including start/stop, stepping, breakpoints
5. **SessionManager** - Main facade that composes all functionality

## Key Components & Data Flow

### Session Storage Foundation
- **SessionStore**: In-memory session registry using Map<string, ManagedSession>
- Manages dual state model (legacy SessionState + new SessionLifecycleState/ExecutionState)
- Handles session creation with UUID generation, language validation, and adapter policy selection
- Provides both public (DebugSessionInfo) and internal (ManagedSession) views

### Core Session Management
- **SessionManagerCore**: Abstract base class with dependency injection architecture
- Manages session lifecycle (CREATED → RUNNING → PAUSED → STOPPED/ERROR)
- Comprehensive proxy event handling system for debug adapter communication
- WeakMap-based event listener tracking for memory leak prevention
- Auto-continue logic for seamless debugging experiences

### Data Operations Layer  
- **SessionManagerData**: Provides read-only operations for debug inspection
- Variable fetching with language-specific policy filtering
- Stack trace retrieval with frame filtering capabilities
- Scope enumeration and local variable extraction
- Consistent error handling with empty result fallbacks

### Operations Layer
- **SessionManagerOperations**: Complete debugging command interface
- Debug session startup with toolchain validation and dry-run support
- Step operations (over/into/out) with thread management
- Breakpoint management and verification
- Expression evaluation in multiple contexts (watch, repl, hover)
- Process attachment/detachment for remote debugging

## Public API Surface

### Main Entry Point
- **SessionManager**: Primary class extending SessionManagerOperations
- Provides complete session management capabilities through inheritance
- Re-exports key types for convenience (SessionManagerDependencies, DebugResult, etc.)

### Key Interfaces
- **SessionManagerDependencies**: Complete dependency injection container
- **CustomLaunchRequestArguments**: Extended VSCode debug protocol options
- **DebugResult**: Standardized response with success/error states and continuation flags
- **EvaluateResult**: Expression evaluation results with type and reference information

### Core Operations
- `createSession()`: New debug session creation with language and executable parameters
- `startDebugging()`: Full debug startup with proxy management and handshake
- `stepOver/Into/Out()`: Code navigation operations
- `setBreakpoint()`: Breakpoint management with verification
- `evaluateExpression()`: REPL-style expression evaluation
- `getVariables/StackTrace/Scopes()`: Debug state inspection
- `attachToProcess/detachFromProcess()`: Remote debugging support

## Internal Organization

### Dependency Injection Pattern
- Constructor injection of file system, networking, logging, and proxy management dependencies
- Factory methods for session stores and proxy managers to enable testability
- Clean separation between business logic and external dependencies

### Event-Driven Architecture
- Proxy managers emit events handled by session manager for state synchronization
- Comprehensive event listener system with cleanup guarantees
- Race condition handling for concurrent operations

### Language Adapter Integration
- Policy pattern for language-specific behavior (Python, JavaScript, Rust, Go, Mock)
- Adapter registry for executable resolution and command building
- Language-specific error handling and toolchain validation

## Important Patterns & Conventions

### State Management
- Dual state model supporting legacy and new lifecycle states
- Centralized state transitions with logging and synchronization
- Thread-aware operations with current session context

### Error Resilience
- Comprehensive error handling with proxy log tail capture for diagnostics
- Graceful degradation with empty results on failure
- Continue-on-error patterns for cleanup operations

### Memory Management
- WeakMap usage for event handler tracking to prevent memory leaks
- Proper cleanup of proxy resources and event listeners
- Session isolation through dedicated proxy managers per session

### Logging Strategy
- Structured logging with session ID prefixes for operation tracking
- Debug adapter communication logging for troubleshooting
- Log directory management with fallback to system temp directories

This module serves as the core debugging infrastructure, providing a complete abstraction over the Debug Adapter Protocol while maintaining language-specific customization through adapter policies and comprehensive state management for debugging workflows.