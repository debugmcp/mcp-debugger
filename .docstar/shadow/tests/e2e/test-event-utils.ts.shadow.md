# tests/e2e/test-event-utils.ts
@source-hash: 56ad6736a5dd0368
@generated: 2026-02-09T18:15:18Z

## Purpose
E2E test utilities for event-based waiting in MCP (Model Context Protocol) server testing. Since the MCP server doesn't expose DAP (Debug Adapter Protocol) events directly, this module provides intelligent polling mechanisms to detect state changes in debugging sessions.

## Key Classes & Functions

### EventRecorder (L13-32)
Debug utility class for recording and replaying test events:
- `record(name, data)` (L16): Adds timestamped event to internal array
- `getEventSequence()` (L20): Returns chronological sequence of event names
- `dumpEvents()` (L24): Console logging for debugging failed tests
- `clear()` (L29): Resets event history

### Core State Management

#### getSessionState (L65-85)
Private async function that polls MCP server for current session state:
- Calls `list_debug_sessions` tool via MCP client
- Returns session state string or null on failure
- Includes comprehensive error logging

#### waitForSessionState (L90-132)
Primary state-waiting function with intelligent polling:
- Uses exponential backoff (L116): `pollInterval * (1 + elapsed/1000)` up to 500ms max
- Supports environment-based timeout multipliers via `TEST_TIMEOUT_MULTIPLIER`
- Comprehensive logging of state transitions and timeout details

### Specialized Event Waiters

#### waitForStoppedEvent (L137-151)
Waits for session to enter 'paused' state, returns `{success, reason}` object

#### waitForContinuedEvent (L156-162)
Waits for session to enter 'running' state

#### waitForTerminatedEvent (L167-173)  
Waits for session to enter 'stopped' state

#### waitForAnyState (L178-220)
Waits for session to reach any state from provided array, returns `{success, state}`

### Composite Operations

#### executeAndWaitForState (L225-243)
Executes operation then waits for expected state change:
- Records initial state for debugging
- Returns both operation result and state-reached boolean

#### smartWaitAfterOperation (L266-281)
Context-aware waiting based on debug operation type:
- `continue`: Waits for either 'paused' (breakpoint hit) or 'stopped' (program ended)
- Step operations: Always waits for 'paused' state

#### waitForBreakpointHit (L249-259)
Specialized waiter for breakpoint scenarios, uses `PYTHON_TIMEOUT` (10s vs 5s default)

### Debugging Utilities

#### collectStatesDuring (L287-303)
Captures state snapshots over time duration for flaky test analysis

#### assertSessionState (L308-319)
Synchronous state assertion with descriptive error messages

## Configuration & Constants

- `DEFAULT_TIMEOUT` (L46): 5000ms base timeout
- `PYTHON_TIMEOUT` (L47): 10000ms for slower Python operations  
- `DEFAULT_POLL_INTERVAL` (L48): 100ms base polling frequency
- `TIMEOUT_MULTIPLIER` (L51-53): Environment-configurable scaling for CI

## Dependencies

- `@modelcontextprotocol/sdk/client` for MCP communication
- `./smoke-test-utils.js` for `parseSdkToolResult` helper

## Architecture Patterns

**Polling Strategy**: Exponential backoff with cap prevents overwhelming server while maintaining responsiveness
**Event Recording**: Optional recording throughout operations enables post-failure analysis  
**Smart Defaults**: Operation-specific timeouts and behaviors (Python vs general, step vs continue)
**Comprehensive Logging**: State transitions logged with timing for debugging