# packages/adapter-javascript/tests/unit/javascript-debug-adapter.dap.test.ts
@source-hash: 32dbc97684a1f951
@generated: 2026-02-10T00:41:09Z

## JavascriptDebugAdapter DAP Protocol Test Suite

Unit tests for the Debug Adapter Protocol (DAP) integration in the JavaScript debug adapter. Validates request handling, event processing, and state management according to DAP specification.

### Test Setup (L8-24)
- **deps (L8-15)**: Mock AdapterDependencies with stubbed logger methods using Vitest mocks
- **beforeEach (L20-24)**: Resets mocks and creates fresh JavascriptDebugAdapter instance for each test

### Key Dependencies
- `@vscode/debugprotocol`: DAP type definitions for events and requests
- `JavascriptDebugAdapter` from `../../src/index.js`: Main adapter class under test
- `AdapterState` from `@debugmcp/shared`: State management types
- Vitest testing framework with mocking capabilities

### Test Coverage

**DAP Request Handling (L26-43)**
- Tests `sendDapRequest` for `setBreakpoints` command
- Validates immutability - original request arguments remain unmodified
- Confirms relative paths are not resolved to absolute during processing
- Verifies return type is object (handled by ProxyManager)

**Output Event Processing (L45-60, L99-113)**
- Tests `handleDapEvent` for output events without explicit category
- Validates default category assignment to "console"
- Includes edge case handling for missing event body (L99-113)
- Uses event listener pattern to capture emitted output

**State Transitions (L62-73)**
- Tests stopped event handling with thread ID tracking
- Validates state transition to `AdapterState.DEBUGGING`
- Confirms `getCurrentThreadId()` returns correct thread ID from event

**Lifecycle Events (L75-97)**
- Tests terminated and exited event emission
- Validates events are properly forwarded without forcing state changes
- Uses event listener pattern to verify emission order

### Architecture Patterns
- Event-driven design with EventEmitter pattern
- State machine with explicit state transitions
- Immutable request processing to prevent side effects
- Defensive programming for missing event properties

### Critical Constraints
- DAP events must maintain protocol compliance
- Original request objects must remain unmodified
- State transitions must follow DAP lifecycle
- Event emission order must be preserved for terminated/exited sequence