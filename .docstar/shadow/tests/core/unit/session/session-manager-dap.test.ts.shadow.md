# tests/core/unit/session/session-manager-dap.test.ts
@source-hash: 99e0902a37012335
@generated: 2026-02-10T00:41:13Z

## Purpose
Test suite for SessionManager's Debug Adapter Protocol (DAP) operations, focusing on breakpoint management, stepping operations, and variable/stack inspection functionality.

## Test Structure
- **Main describe block (L11)**: "SessionManager - DAP Operations" 
- **Setup/teardown (L16-34)**: Uses vitest with fake timers, creates mock dependencies and SessionManager instance with test config
- **Helper function `createPausedSession()` (L36-52)**: Creates session, starts debugging, simulates stopped state, and clears mock calls

## Key Test Categories

### Breakpoint Management (L54-122)
Tests breakpoint queuing and verification:
- **L55-69**: Queuing breakpoints before session starts (unverified state)
- **L71-96**: Sending breakpoints to active sessions (immediate verification)
- **L98-121**: Conditional breakpoints with expressions

### Step Operations (L124-218)
Tests debugging step commands:
- **L125-138**: Step over (`next` DAP command)
- **L140-150**: Step into (`stepIn` DAP command) 
- **L152-162**: Step out (`stepOut` DAP command)
- **L164-182**: Error handling for non-paused sessions (ProxyNotRunningError)
- **L184-198**: Step timeout handling (5 second timeout)
- **L200-217**: Termination during step operations

### Variable Inspection (L220-275)
Tests variable retrieval with scope fallback:
- **L221-274**: Falls back to Script/Global scopes when Local scope unavailable
- Uses mock DAP responses for `stackTrace`, `scopes`, and `variables` commands

### Stack and Variable Inspection (L277-390)
Comprehensive inspection operations:
- **L278-304**: Variable retrieval by scope reference
- **L306-332**: Stack trace retrieval 
- **L334-359**: Scope retrieval for frames
- **L361-389**: Graceful handling when session not paused (returns empty arrays)

## Dependencies
- **SessionManager**: Main class under test from `../../../../src/session/session-manager.js`
- **Mock utilities**: `createMockDependencies()` from local test utils
- **Error types**: `ProxyNotRunningError` for DAP operation failures
- **Shared types**: `DebugLanguage.MOCK` for test sessions

## Test Patterns
- Consistent use of async/await with `vi.runAllTimersAsync()` for timer advancement
- Mock proxy manager tracks DAP requests via `dapRequestCalls` array
- Sessions use Python executable path with 'test.py' files
- Thread ID 1 consistently used for paused state simulation
- Error messages validated using `ErrorMessages.stepTimeout()`