# src/session/
@generated: 2026-02-09T18:16:15Z

## Overall Purpose

The `src/session` module provides comprehensive debug session management functionality for the Debug MCP Server. This is the core orchestration layer that manages debug session lifecycle, coordinates with debug adapters through proxy managers, and provides a unified API for debug operations including execution control, data retrieval, and session state management.

## Architecture Overview

The module follows a layered architecture with clear separation of concerns:

```
SessionManager (facade/entry point)
    ↓ extends
SessionManagerOperations (execution control & operations)
    ↓ extends  
SessionManagerData (data retrieval via DAP)
    ↓ extends
SessionManagerCore (lifecycle & event management)
    ↓ uses
SessionStore (pure data layer)
```

## Key Components & Relationships

### SessionManager (Main Entry Point)
- **File:** `session-manager.ts`  
- **Role:** Primary facade and composition root
- **API:** Complete debug session management interface
- **Usage:** Main class consumers should instantiate

### Core Functionality Layers

**SessionManagerCore**
- Event-driven session lifecycle management
- Proxy manager event coordination (stopped/continued/terminated/error)
- Dependency injection pattern with full testing support
- WeakMap-based event handler tracking for memory safety

**SessionManagerData**  
- Debug Adapter Protocol (DAP) data retrieval operations
- Language-specific policy system for adapter behavior customization
- Methods: `getVariables()`, `getStackTrace()`, `getScopes()`, `getLocalVariables()`

**SessionManagerOperations**
- Debug execution control and session operations
- Methods: `startDebugging()`, stepping operations, `evaluateExpression()`, breakpoint management
- Process attachment/detachment capabilities
- Dry-run mode with timeout-based completion detection

**SessionStore**
- Pure data layer for session CRUD operations
- Session state management with dual state model (legacy + new lifecycle/execution states)
- Language policy integration and toolchain validation
- No external dependencies for improved testability

## Public API Surface

### Primary Entry Points
- `SessionManager` class - Main interface for all session operations
- `createSession(params)` - Initialize new debug session
- `startDebugging(sessionId, launchArgs)` - Begin debug session execution  
- `closeSession(sessionId)` / `closeAllSessions()` - Session cleanup

### Debug Operations
- **Execution Control:** `stepOver()`, `stepInto()`, `stepOut()`, `continue()`
- **Data Retrieval:** `getVariables()`, `getStackTrace()`, `getLocalVariables()`
- **Expression Evaluation:** `evaluateExpression()`
- **Breakpoints:** `setBreakpoint()`
- **Process Management:** `attachToProcess()`, `detachFromProcess()`

### Configuration & Dependencies
- `SessionManagerConfig` - Configuration options with sensible defaults
- `SessionManagerDependencies` - Full dependency injection interface
- Support for custom launch arguments and adapter-specific parameters

## Internal Organization & Data Flow

### Session Lifecycle
1. **Creation:** SessionStore creates session with UUID and language validation
2. **Initialization:** Proxy manager setup with adapter configuration and event handlers
3. **Execution:** State transitions managed through proxy events (INITIALIZING → RUNNING/PAUSED → STOPPED/ERROR)
4. **Operations:** Debug commands routed through proxy managers via DAP
5. **Cleanup:** Event handler removal and proxy manager termination

### State Management
- Dual state model maintaining both legacy `SessionState` and new `sessionLifecycle`/`executionState`
- Event-driven state transitions with comprehensive logging
- Auto-continue logic for `stopOnEntry=false` scenarios
- Stale event protection and session validation

### Language Policy System
- `AdapterPolicy` implementations for Python, JavaScript, Rust, Go, Mock
- Language-specific handshakes, stack frame filtering, and variable extraction
- Executable path resolution and toolchain validation

## Key Design Patterns

### Dependency Injection
Full constructor injection enabling testing and modular design across all layers.

### Event-Driven Architecture  
Proxy manager events drive session state transitions with comprehensive handler management.

### Policy Pattern
Language-specific behavior customization through pluggable AdapterPolicy implementations.

### Layered Architecture
Clear separation between data access, operations, lifecycle management, and storage concerns.

## Critical Invariants

- Sessions must be in PAUSED state for stepping operations and expression evaluation
- Proxy manager event handlers must be properly cleaned up to prevent memory leaks
- Session state consistency maintained across both legacy and new state models
- Thread ID required for all execution control operations
- Each session requires its own ProxyManager instance for process isolation

## Configuration Defaults

- Log directory: `${tmpdir}/debug-mcp-server/sessions`
- `stopOnEntry`: true, `justMyCode`: true  
- `dryRunTimeoutMs`: 10000ms
- Comprehensive error handling with toolchain validation and graceful degradation