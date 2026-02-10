# tests/unit/shared/adapter-policy-js.test.ts
@source-hash: 51adcd2b64694809
@generated: 2026-02-09T18:14:54Z

## Purpose
Unit test suite for the JavaScript Debug Adapter Policy, testing DAP (Debug Adapter Protocol) command processing, state management, and debugging workflow coordination for JavaScript/Node.js debugging sessions.

## Test Structure
The test suite covers the `JsDebugAdapterPolicy` class with comprehensive test cases for:

### Core Functionality Tests
- **Child Process Start Args (L6-16)**: Tests `buildChildStartArgs()` method that configures debug adapter child processes with `attach` command, `pwa-node` type, and pending target ID handling
- **Child Readiness Detection (L18-22)**: Validates `isChildReadyEvent()` correctly identifies `thread` and `stopped` events as readiness indicators while rejecting `continued` events
- **Stack Frame Filtering (L24-37)**: Tests `filterStackFrames()` method that removes Node.js internal frames (containing `<node_internals>`) when internal filtering is disabled
- **Variable Extraction (L39-71)**: Tests `extractLocalVariables()` that filters out special JavaScript variables (`this`, `__proto__`, `$internal`) from local scope unless explicitly requested

### State Management Tests
- **Command Queueing Logic (L73-87)**: Tests `shouldQueueCommand()` and state progression through initialization phases (`initializeResponded`, `initialized`, `configurationDone`)
- **Command Ordering (L89-104)**: Validates `processQueuedCommands()` enforces JS-specific command precedence: `setBreakpoints` → `configurationDone` → `launch` → `evaluate`
- **Connection State Tracking (L106-115)**: Tests `isConnected()` and `isInitialized()` state queries with `updateStateOnEvent()` transitions
- **Response State Updates (L117-123)**: Validates `updateStateOnResponse()` marks initialize response reception

### Adapter Identification Tests
- **Adapter Matching (L125-132)**: Tests `matchesAdapter()` correctly identifies js-debug adapter commands vs other debugger types
- **Configuration Defaults (L134-142)**: Validates initialization behavior flags and executable path resolution

### Integration Handshake Tests
- **Launch Flow (L145-185)**: Complex integration test of `performHandshake()` with mocked EventEmitter, testing full DAP sequence: initialize → setExceptionBreakpoints → setBreakpoints → configurationDone → launch
- **Attach Flow (L187-219)**: Tests alternative handshake flow when `attachSimplePort` is provided, ensuring `attach` command is used instead of `launch`

## Dependencies
- **Vitest**: Testing framework with mocking capabilities (`vi`)
- **EventEmitter**: Node.js events for async handshake testing
- **JsDebugAdapterPolicy**: Main class under test from shared adapter policy module

## Test Patterns
- Uses `vi.useFakeTimers()` for precise async timing control in handshake tests (L146, L188)
- Employs mock functions for DAP request simulation
- Creates synthetic test data for frames, scopes, and variables with realistic JavaScript debugging scenarios
- Tests both positive and negative cases for each policy decision point

## Key Testing Concerns
- DAP protocol compliance and command sequencing
- JavaScript-specific debugging features (Node.js internals filtering, special variable handling)
- State machine transitions during adapter initialization
- Async handshake coordination with proper event handling