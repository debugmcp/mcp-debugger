# src/session/session-manager-operations.ts
@source-hash: d4dd17e80877865e
@generated: 2026-02-11T16:13:01Z

## Purpose
SessionManagerOperations provides core debugging operations for managing debug sessions including starting/stopping, stepping, breakpoints, expression evaluation, and process attachment. It extends SessionManagerData and acts as the primary interface for debug protocol interactions.

## Key Classes & Interfaces

**SessionManagerOperations (L49-1478)** - Abstract class providing debug operations
- Manages debug session lifecycle and proxy communication
- Handles DAP (Debug Adapter Protocol) requests and responses
- Coordinates language-specific adapter behavior through policies
- Implements stepping, breakpoint management, and expression evaluation

**EvaluateResult (L35-44)** - Interface for expression evaluation results
- Contains evaluation success status, result value, type information
- Includes variable references for complex objects with children
- Used for REPL-style debugging interactions

## Core Operations

**startDebugging (L358-695)** - Main entry point for starting debug sessions
- Creates session log directories and validates toolchain compatibility
- Handles both normal and dry-run execution modes
- Sets up proxy managers and performs language-specific handshakes
- Returns DebugResult with session state and metadata

**startProxyManager (L50-295)** - Creates and configures proxy for debug adapter communication
- Resolves executable paths through language adapters
- Builds adapter commands and launch configurations
- Handles attach vs launch mode detection
- Sets up initial breakpoints and event handlers

**Step Operations (L783-1026)**
- stepOver (L783-823), stepInto (L825-865), stepOut (L867-907)
- All delegate to _executeStepOperation for consistent behavior
- Handle thread ID validation and state transitions
- Capture location information after stepping

**Breakpoint Management (L698-781)**
- setBreakpoint creates and sends breakpoints to active sessions
- Validates session state and handles verification responses
- Maintains breakpoint map for session persistence

**Expression Evaluation (L1103-1280)**
- evaluateExpression supports watch, repl, hover, and variables contexts
- Requires paused session state for safe evaluation
- Automatically resolves current frame if not specified
- Returns structured results with type and reference information

## Process Attachment

**attachToProcess (L1285-1373)** - Attaches to running processes
- Supports remote debugging via host/port or process ID
- Handles stopOnEntry behavior for different attachment scenarios
- Uses special __attachMode flag for adapter configuration

**detachFromProcess (L1378-1437)** - Cleanly detaches from processes
- Optional process termination vs clean disconnect
- Sends DAP disconnect requests before cleanup

## Dependencies & Architecture

**Core Dependencies:**
- @debugmcp/shared for types and enums
- @vscode/debugprotocol for DAP types
- SessionManagerData base class for data operations
- ProxyConfig and ProxyManager for adapter communication

**Adapter Integration:**
- Uses adapter registry to create language-specific adapters
- Delegates executable resolution and command building to adapters
- Applies language policies for initialization and handshake behavior

**Error Handling:**
- Comprehensive error capture with proxy log tails for diagnostics
- Language-specific error conversion (e.g., PythonNotFoundError)
- Toolchain validation with continue/warn/error behaviors

## Key Patterns

**State Management:**
- Consistent state transitions through _updateSessionState
- Session lifecycle tracking (CREATED → ACTIVE → TERMINATED)
- Proxy event handlers for state synchronization

**Async Operation Handling:**
- Promise-based operations with timeout mechanisms
- Event listener cleanup patterns in finally blocks
- Race condition handling for step operations and dry runs

**Logging Strategy:**
- Structured logging for debugging events with timestamps
- Comprehensive error details capture for CI debugging
- Log truncation for large evaluation results