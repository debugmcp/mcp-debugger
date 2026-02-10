# tests/core/unit/session/session-manager-error-recovery.test.ts
@source-hash: fad556491fed2237
@generated: 2026-02-10T00:41:13Z

## Purpose
Test file validating SessionManager's error recovery capabilities, specifically focusing on proxy crash scenarios and timeout handling. Uses Vitest framework with mocked dependencies to simulate failure conditions.

## Test Structure

### Main Test Setup (L14-32)
- **beforeEach (L14-26)**: Configures fake timers, creates mock dependencies, and initializes SessionManager with test config
- **afterEach (L28-32)**: Resets timers, clears mocks, and resets proxy manager state
- **config (L17-23)**: Standard test configuration with stopOnEntry and justMyCode enabled

### Proxy Crash Recovery Tests (L34-93)

#### Unexpected Proxy Crash (L35-53)
- Creates session, starts debugging, simulates proxy crash via `simulateExit(1, 'SIGKILL')`
- Validates session transitions to ERROR state and proxy manager is cleaned up
- Tests core crash detection and cleanup logic

#### Restart After Crash (L55-76)
- Simulates full crash-restart cycle
- Verifies SessionManager can recover and restart debugging after proxy failure
- Tests resilience and recovery capabilities

#### Early Exit Scenario (L78-92)
- Tests "proxy exited before initialization" case using `shouldFailStart = true`
- Validates proper error handling when proxy fails during startup phase

### Timeout Handling Tests (L95-156)

#### Successful Initialization (L96-117)
- Tests normal proxy initialization flow with simulated async events
- Uses `setTimeout` and `advanceTimersByTimeAsync` to control timing
- Validates successful startup path

#### DAP Command Timeouts (L119-139)
- Tests behavior when session is in RUNNING state (not paused)
- Manually sets session state to RUNNING to test edge case
- Validates `getVariables` returns empty array when not paused

#### Cleanup After Timeout (L141-155)
- Tests cleanup behavior when proxy startup fails
- Ensures session reaches ERROR state and proxy manager is undefined

## Key Dependencies
- **SessionManager**: Main class under test from session-manager.js
- **createMockDependencies**: Test utility providing mocked proxy manager and other dependencies
- **DebugLanguage.MOCK**: Test language enum value
- **SessionState**: Enum for tracking session lifecycle states

## Testing Patterns
- Heavy use of Vitest fake timers (`vi.useFakeTimers`, `vi.runAllTimersAsync`)
- Mock proxy manager with controllable failure modes (`shouldFailStart`, `simulateExit`)
- State-based assertions checking session state transitions
- Async/await patterns with timer advancement for proper sequencing