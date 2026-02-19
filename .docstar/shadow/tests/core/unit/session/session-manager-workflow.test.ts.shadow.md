# tests\core\unit\session\session-manager-workflow.test.ts
@source-hash: 9aa0c653cbb79e6e
@generated: 2026-02-19T23:47:37Z

## Purpose
Unit test file for SessionManager debug session workflow integration testing. Tests complete debug cycles including session creation, debugging start/stop, breakpoint management, and stepping operations.

## Test Structure
- Main test suite: `SessionManager - Debug Session Workflow` (L9-149)
- Uses vitest framework with mocked dependencies via `createMockDependencies()` (L16)
- Fake timers enabled for async operation control (L15, L58, L100, L139)

## Key Test Components

### Setup/Teardown (L14-32)
- `beforeEach`: Creates mock dependencies, configures SessionManager with test config including logDirBase and defaultDapLaunchArgs
- `afterEach`: Resets timers, clears mocks, and resets proxy manager state

### Complete Debug Cycle Test (L35-83)
Primary integration test covering full workflow:
1. Session creation with MOCK language (L37-47)
2. Debug start with stopOnEntry=true (L50-62) 
3. Breakpoint setting and verification (L65-72)
4. Step over operation (L75-77)
5. Session cleanup and closure (L80-82)

### Dry Run Workflow Test (L85-114)
Tests dry run debugging mode:
- Verifies dry run flag propagation to proxy manager (L113)
- Confirms session ends in STOPPED state without initialization errors (L105, L108-110)

### stopOnEntry=false Workflow Test (L116-147)
Tests non-blocking debug start:
- Mocks proxy behavior for continuous running (L123-130)
- Verifies session reaches RUNNING state instead of PAUSED (L143)
- Validates stopOnEntry parameter passing (L146)

## Dependencies
- SessionManager and SessionManagerConfig from session-manager.js
- DebugLanguage, SessionState from @debugmcp/shared
- Mock utilities from session-manager-test-utils.js
- Vitest testing framework

## Test Patterns
- Heavy use of mock proxy manager for DAP protocol simulation
- Timer manipulation for async workflow control
- State transition verification at each workflow step
- Error condition validation (dry run error checking)

## Architecture Notes
- Tests integration between SessionManager and proxy manager layer
- Validates DAP protocol request/response patterns
- Ensures proper session state management throughout debug lifecycle