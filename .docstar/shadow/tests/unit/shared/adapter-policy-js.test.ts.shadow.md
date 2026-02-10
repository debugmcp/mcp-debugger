# tests/unit/shared/adapter-policy-js.test.ts
@source-hash: 51adcd2b64694809
@generated: 2026-02-10T00:41:45Z

## Purpose
Unit test file that comprehensively validates the `JsDebugAdapterPolicy` class, which manages JavaScript debug session behavior, command ordering, and debug adapter protocol (DAP) interactions for Node.js debugging.

## Test Structure & Coverage

### Child Process Management (L6-16)
- **buildChildStartArgs test (L6-16)**: Validates creation of child debug adapter arguments with pending target IDs, ensuring proper `attach` command configuration with `pwa-node` type and `continueOnAttach: true`.

### Event Detection (L18-22)  
- **isChildReadyEvent test (L18-22)**: Verifies detection of debug readiness events, specifically identifying `thread` and `stopped` as ready signals while excluding `continued`.

### Stack Frame Filtering (L24-37)
- **filterStackFrames test (L24-37)**: Tests exclusion of Node.js internal stack frames (containing `<node_internals>`) while preserving application and module frames. Validates toggle behavior for including/excluding internals.

### Variable Extraction (L39-71)
- **extractLocalVariables test (L39-71)**: Validates extraction of local variables from debug scopes while filtering out special entries (`this`, `__proto__`, variables starting with `$`). Tests optional inclusion of special variables.

### Command Queueing Logic (L73-87)
- **shouldQueueCommand test (L73-87)**: Verifies state-dependent command queuing based on initialization phases:
  - Before `initializeResponded`: queue all commands
  - Before `configurationDone`: queue setup commands  
  - After full initialization: no queuing required

### Command Ordering (L89-104)
- **processQueuedCommands test (L89-104)**: Validates JS-specific command ordering: `setBreakpoints` → `configurationDone` → `launch` → other commands.

### State Management (L106-123)
- **State tracking tests (L106-115)**: Validates initialization and connectivity state management through event updates.
- **updateStateOnResponse test (L117-123)**: Verifies state updates on DAP response handling, specifically `initializeResponded` flag setting.

### Adapter Identification (L125-132)
- **matchesAdapter test (L125-132)**: Tests detection of js-debug adapter instances by command/args patterns, distinguishing from other debuggers like Python's debugpy.

### Configuration & Defaults (L134-142)
- **Initialization behavior test (L134-142)**: Validates policy settings like `deferConfigDone: true`, `addRuntimeExecutable: true`, and executable path resolution.

## Handshake Flow Integration Tests (L144-220)

### Launch Flow (L145-185)
- **performHandshake launch test (L145-185)**: Comprehensive integration test of debug session initialization:
  - Mocks `EventEmitter`-based proxy manager
  - Simulates DAP event flow with fake timers
  - Validates complete handshake sequence: initialize → setExceptionBreakpoints → setBreakpoints → configurationDone → launch
  - Verifies breakpoint mapping from internal format to DAP format

### Attach Flow (L187-219)  
- **performHandshake attach test (L187-219)**: Tests attach-mode debugging with existing Node.js processes:
  - Uses `attachSimplePort` configuration
  - Validates attach command generation instead of launch
  - Confirms port forwarding setup

## Key Dependencies
- **vitest**: Test framework with mocking and timing control
- **EventEmitter**: Node.js events for proxy manager simulation  
- **JsDebugAdapterPolicy**: The policy class being tested from `adapter-policy-js.js`

## Test Patterns
- Extensive use of `vi.fn()` mocks for DAP request simulation
- Fake timer control for async handshake testing
- Type casting with `as any` for simplified test data structures
- Event-driven testing with manual event emission for flow control