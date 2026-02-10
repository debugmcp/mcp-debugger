# tests/e2e/test-event-utils.ts
@source-hash: 56ad6736a5dd0368
@generated: 2026-02-10T00:42:05Z

## Purpose
E2E test utilities for waiting on debug session state changes in MCP-based debugger tests. Provides intelligent polling mechanisms to detect DAP-like events since the MCP server doesn't expose DAP events directly.

## Core Components

### EventRecorder Class (L13-32)
- **Purpose**: Debug helper for recording and dumping event sequences during test failures
- **Key Methods**:
  - `record()` (L16): Logs events with timestamps
  - `getEventSequence()` (L20): Returns just event names
  - `dumpEvents()` (L24): Console logs full event history
  - `clear()` (L29): Resets event history

### Configuration & Constants (L37-60)
- **WaitOptions interface** (L37): Configures timeout, poll interval, and event recording
- **Timeout constants**: `DEFAULT_TIMEOUT` (5s), `PYTHON_TIMEOUT` (10s for slower operations)
- **Environment integration**: `TIMEOUT_MULTIPLIER` from env var for CI scaling
- **getAdjustedTimeout()** (L58): Applies multiplier for different environments

### Core Session State Management (L65-85)
- **getSessionState()** (L65): Queries MCP server via `list_debug_sessions` tool
- Returns session state string or null
- Includes comprehensive error logging and session discovery

## Primary Waiting Functions

### Basic State Waiting (L90-132)
- **waitForSessionState()** (L90): Core polling function with exponential backoff
- Features timeout handling, progress logging, and event recording integration
- Returns boolean success status

### Specialized Event Waiters (L137-173)
- **waitForStoppedEvent()** (L137): Waits for 'paused' state (breakpoint hits)
- **waitForContinuedEvent()** (L156): Waits for 'running' state  
- **waitForTerminatedEvent()** (L167): Waits for 'stopped' state (program end)

### Advanced Waiting Patterns (L178-281)
- **waitForAnyState()** (L178): Waits for any of multiple acceptable states
- **executeAndWaitForState()** (L225): Executes operation then waits for expected state change
- **waitForBreakpointHit()** (L249): Specialized for post-continue breakpoint detection
- **smartWaitAfterOperation()** (L266): Context-aware waiting based on operation type
  - Continue operations → wait for 'paused' OR 'stopped'
  - Step operations → wait for 'paused' only

## Debugging & Utilities (L287-319)
- **collectStatesDuring()** (L287): Records state changes over time intervals for flaky test analysis
- **assertSessionState()** (L308): Assertion helper with descriptive error messages

## Key Architectural Patterns
- **Exponential backoff**: Polling intervals increase over time to reduce server load
- **Comprehensive logging**: All operations include detailed console output with timing
- **Graceful degradation**: Continues operation even when session state queries fail
- **CI-aware timeouts**: Environment-based timeout scaling for different execution contexts
- **Event-driven debugging**: Optional event recording for post-mortem test analysis

## Dependencies
- `@modelcontextprotocol/sdk/client` for MCP server communication
- `./smoke-test-utils.js` for result parsing utilities

## Critical Invariants
- All state polling uses the `list_debug_sessions` MCP tool as the single source of truth
- Timeout handling always includes final state check for better error messages
- Event recorder integration is optional but recommended for debugging flaky tests