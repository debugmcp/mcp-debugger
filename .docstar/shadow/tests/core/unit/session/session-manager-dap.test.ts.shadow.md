# tests/core/unit/session/session-manager-dap.test.ts
@source-hash: 99e0902a37012335
@generated: 2026-02-09T18:14:23Z

## Purpose
Test suite for SessionManager's Debug Adapter Protocol (DAP) operations using Vitest framework. Validates breakpoint management, step operations, and variable/stack inspection functionality in isolation with mocked dependencies.

## Test Structure
- **Main describe block** (L11): "SessionManager - DAP Operations"
- **Setup/teardown** (L16-34): Configures fake timers, mock dependencies, and SessionManager instance
- **createPausedSession helper** (L36-52): Creates session in paused state for testing step operations

## Test Groups

### Breakpoint Management (L54-122)
- **Queued breakpoints test** (L55-69): Verifies breakpoints queue when session not started
- **Active session breakpoints test** (L71-96): Validates immediate DAP communication for active sessions
- **Conditional breakpoints test** (L98-121): Tests breakpoint conditions are properly transmitted

### Step Operations (L124-218)
- **Step over test** (L125-138): Validates `next` DAP command execution
- **Step into test** (L140-150): Validates `stepIn` DAP command execution  
- **Step out test** (L152-162): Validates `stepOut` DAP command execution
- **Invalid state handling** (L164-182): Tests rejection when not paused, handles ProxyNotRunningError
- **Step timeout test** (L184-198): Validates 5-second timeout mechanism with ErrorMessages
- **Termination during step test** (L200-217): Ensures termination events are treated as successful step completion

### Variable Inspection (L220-275)
- **Scope fallback test** (L221-274): Tests fallback to Script/Global scopes when Local scope unavailable, mocks complex DAP request/response chain

### Variable and Stack Inspection (L277-390)
- **Variables retrieval test** (L278-304): Tests `getVariables` with variablesReference
- **Stack trace test** (L306-332): Tests `getStackTrace` with threadId
- **Scopes retrieval test** (L334-359): Tests `getScopes` with frameId  
- **Not paused state test** (L361-389): Validates empty arrays returned when session not paused

## Key Dependencies
- **SessionManager** (L5): Main class under test from session-manager.js
- **DebugLanguage.MOCK** (L6): Test language enum from @debugmcp/shared
- **createMockDependencies** (L7): Mock factory from test utilities
- **ProxyNotRunningError** (L9): Typed error for proxy state validation
- **ErrorMessages** (L8): Centralized error message constants

## Test Patterns
- Uses fake timers with `vi.useFakeTimers()` for async operation control
- Validates DAP command transmission through `mockProxyManager.dapRequestCalls`
- Tests both success and error scenarios with typed error handling
- Simulates debugger events through `mockProxyManager.simulateStopped()`