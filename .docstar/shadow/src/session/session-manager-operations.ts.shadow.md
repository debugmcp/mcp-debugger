# src/session/session-manager-operations.ts
@source-hash: 50fc1ceaf91efd7a
@generated: 2026-02-09T18:15:23Z

## Purpose
Extends SessionManagerData to provide debug session execution control operations including starting/stopping debugging, stepping, breakpoint management, expression evaluation, and process attachment. Core orchestration layer for managing debug adapters through proxy managers.

## Key Classes & Interfaces

### EvaluateResult Interface (L35-44)
Result container for expression evaluation operations with success status, result value, type information, and variable references for expandable objects.

### SessionManagerOperations Class (L49-1570)
Main class extending SessionManagerData providing debug session lifecycle management and execution control.

#### Core Session Management

**startProxyManager()** (L50-309)
- Creates session log directories and validates toolchain compatibility
- Configures adapter with port allocation and breakpoint initialization  
- Handles both launch and attach modes with language-specific transformations
- Sets up proxy event handlers and starts ProxyManager with resolved executable paths

**startDebugging()** (L372-764)
- Main entry point for debug session initialization
- Handles dry-run mode with timeout-based completion detection (L409-538)
- Performs language-specific handshakes and waits for adapter readiness
- Comprehensive error handling with toolchain validation and log capture

**waitForDryRunCompletion()** (L314-370)
Private helper using Promise.race() for timeout-based dry run completion detection with event cleanup.

#### Stepping Operations

**stepOver()** (L852-892), **stepInto()** (L894-934), **stepOut()** (L936-976)
- Validate session state (PAUSED) and thread availability
- Delegate to _executeStepOperation() with command-specific parameters
- Handle SessionTerminatedError and ProxyNotRunningError

**_executeStepOperation()** (L978-1095)
- Promise-based step execution with event listeners for stopped/terminated/exited
- Captures current location from stack trace after step completion (L1037-1059)
- 5-second timeout with cleanup and state management

**continue()** (L1097-1150)
Resumes paused session execution with DAP continue request and state transition to RUNNING.

#### Expression Evaluation

**evaluateExpression()** (L1172-1349)
- Validates session is paused and obtains current frame if not specified
- Sends DAP evaluate request with context support (watch/repl/hover/variables)
- Comprehensive error handling with user-friendly error type detection
- Structured logging for debugging and result truncation for performance

#### Process Attachment

**attachToProcess()** (L1354-1464)
- Handles remote debugging through port/host or process ID attachment
- Auto-detects Java JDWP suspend mode for proper state initialization
- Sets default thread ID and appropriate session state (PAUSED/RUNNING)

**detachFromProcess()** (L1469-1528)
Graceful detachment with optional process termination using DAP disconnect request.

#### Breakpoint Management

**setBreakpoint()** (L767-850)
- Creates breakpoint with UUID and validates session lifecycle state
- Immediately sends to active proxy or queues for session start
- Updates breakpoint verification status and captures validation messages

## Key Dependencies
- **@debugmcp/shared**: Core types (Breakpoint, SessionState, AdapterConfig)
- **@vscode/debugprotocol**: DAP request/response types
- **ProxyManager**: Debug adapter communication layer
- **AdapterRegistry**: Language-specific adapter creation and configuration

## Architectural Patterns

### State Management
Maintains session state transitions (INITIALIZING → RUNNING/PAUSED → STOPPED/ERROR) with lifecycle validation.

### Event-Driven Architecture
Extensive use of ProxyManager events (stopped, terminated, exited, adapter-configured) for asynchronous operation coordination.

### Language Policy System
Delegates to language-specific policies for handshakes and readiness criteria through selectPolicy().

### Error Recovery
Comprehensive error capture with toolchain validation, log tail extraction, and graceful degradation for Windows CI debugging.

## Critical Constraints
- Sessions must be PAUSED for stepping operations and expression evaluation
- Dry run operations have configurable timeout (dryRunTimeoutMs)
- Thread ID required for all stepping and continuation operations
- Expression evaluation requires active stack frame context
- Attach mode requires special handling of launch vs attach configuration transforms