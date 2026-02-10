# packages/adapter-javascript/tests/unit/javascript-debug-adapter.dap.test.ts
@source-hash: 32dbc97684a1f951
@generated: 2026-02-09T18:14:02Z

## Purpose
Unit test file for JavascriptDebugAdapter's Debug Adapter Protocol (DAP) message handling capabilities. Tests the adapter's plumbing between DAP requests/events and internal state management without involving actual debugging sessions.

## Test Structure
- **Test Suite** (L17-114): "JavascriptDebugAdapter DAP plumbing" validates core DAP message processing
- **Setup** (L20-24): Creates fresh adapter instance with mocked dependencies before each test
- **Dependencies Mock** (L8-15): Minimal AdapterDependencies stub with logger functions

## Key Test Cases

### Request Handling
- **setBreakpoints validation** (L26-43): Verifies `sendDapRequest()` performs minimal validation without mutating input arguments, ensuring relative paths remain unchanged

### Event Processing
- **Output event handling** (L45-60): Tests `handleDapEvent()` for output events, verifying default category assignment ("console" when unspecified)
- **Stopped event processing** (L62-73): Validates stopped events update `currentThreadId` and transition adapter state to `AdapterState.DEBUGGING`
- **Termination events** (L75-97): Confirms terminated/exited events are properly emitted without forced state changes
- **Missing body tolerance** (L99-113): Tests graceful handling of malformed events with missing body properties

## Dependencies
- **@vscode/debugprotocol**: DAP type definitions for events and requests
- **@debugmcp/shared**: AdapterState enum and AdapterDependencies interface
- **JavascriptDebugAdapter**: Main adapter class under test (L4)

## Testing Patterns
- Event listener pattern for capturing emitted events (L47, L77, L101)
- Deep cloning for mutation detection (L31)
- Type casting for malformed event simulation (L108)
- State validation through getter methods (L71-72)