# src\session\session-manager-operations.ts
@source-hash: 7077a49f505313eb
@generated: 2026-02-23T15:26:08Z

## Purpose
Core debug operations implementation extending SessionManagerData to provide debug session management including starting/stepping/continuing debugging, breakpoint management, expression evaluation, and process attach/detach operations.

## Architecture
Abstract class SessionManagerOperations (L49) extends SessionManagerData, implementing debug lifecycle management through ProxyManager coordination with language-specific debug adapters.

## Key Classes & Functions

### Main Class
- **SessionManagerOperations** (L49): Abstract class providing debug operations
  - **startProxyManager** (L50-295): Complex session initialization with adapter creation, proxy setup, and toolchain validation
  - **startDebugging** (L358-743): Primary debug session start with dry-run support and comprehensive error handling
  - **waitForDryRunCompletion** (L300-356): Helper for dry-run timeout management with event cleanup

### Debug Control Operations
- **stepOver** (L832-872): Step over operation with thread validation
- **stepInto** (L874-914): Step into operation with thread validation  
- **stepOut** (L916-956): Step out operation with thread validation
- **_executeStepOperation** (L958-1075): Common step operation implementation with timeout and location capture
- **continue** (L1077-1130): Continue execution from paused state

### Breakpoint Management
- **setBreakpoint** (L747-830): Add breakpoint with verification and live session sync

### Expression Evaluation
- **evaluateExpression** (L1152-1328): Evaluate expressions in debug context with comprehensive validation and structured logging

### Process Attach/Detach
- **attachToProcess** (L1334-1422): Attach to running process for debugging
- **detachFromProcess** (L1427-1486): Detach from process with optional termination

### Utility Methods
- **truncateForLog** (L1136-1139): String truncation for logging
- **waitForInitialBreakpointPause** (L1491-1527): Wait for initial breakpoint pause

## Key Dependencies
- Debug adapters via AdapterRegistry for language-specific operations
- ProxyManager for DAP communication  
- SessionStore for session state persistence
- ErrorMessages utility for consistent error handling
- Various debug-specific error types (SessionTerminatedError, ProxyNotRunningError, etc.)

## Data Flow
1. startDebugging creates adapter config, resolves executable, builds launch config
2. startProxyManager initializes ProxyManager with adapter command and configuration
3. Debug operations (step/continue) send DAP requests through ProxyManager
4. Session state updates propagated through _updateSessionState calls
5. Breakpoints synchronized between session store and active debug adapter

## Error Handling Patterns
- Session termination checks before operations
- Comprehensive error capture with proxy log tails for debugging
- Toolchain validation with continuation policies
- Timeout management for async operations (dry-run, step operations)
- Graceful degradation with detailed error reporting

## Critical Invariants
- Session must be PAUSED for step operations and expression evaluation
- ProxyManager must be running for debug operations
- Thread ID required for step/continue operations
- File paths must be validated before breakpoint setting
- Lifecycle state transitions coordinated with session state updates