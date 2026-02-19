# tests\core\unit\session\session-manager-multi-session.test.ts
@source-hash: 1be2ee4d3a5a06b5
@generated: 2026-02-19T23:47:38Z

## Purpose
Test suite for SessionManager's multi-session management capabilities using vitest. Validates concurrent session handling, state isolation, and bulk operations.

## Test Structure
- **Test Suite** (L10-171): "SessionManager - Multi-Session Management" 
- **Setup/Teardown** (L15-33): Mock dependencies, fake timers, and cleanup
- **Core Variables** (L11-13): sessionManager, dependencies, config instances

## Key Test Cases

### Multi-Session Concurrency (L35-70)
Tests creation and management of 3 concurrent debug sessions:
- Creates sessions with MOCK language and unique names
- Starts debugging on different files (test1.py, test2.py, test3.py)
- Validates all sessions reach PAUSED state independently
- Uses `vi.runAllTimersAsync()` for async timer resolution

### Session State Isolation (L72-106)
Validates independent session state management:
- Creates separate MockProxyManager instances per session (L74-80)
- Uses `proxyManagerFactory.create` mock with counter-based selection
- Tests that continuing one session doesn't affect others
- Simulates DAP events (`simulateStopped`, `simulateEvent`) on specific proxies

### Bulk Session Management (L108-170)
Tests `closeAllSessions()` functionality:
- **Happy Path** (L108-130): Closes multiple active sessions, validates cleanup
- **Empty List** (L132-142): Handles no active sessions gracefully
- **Error Handling** (L144-170): Continues cleanup despite individual session failures

## Dependencies
- **SessionManager/Config** (L5): Main class under test from session-manager.js
- **Shared Types** (L6): DebugLanguage.MOCK, SessionState.PAUSED
- **Test Utils** (L7-8): MockProxyManager and createMockDependencies helper
- **Vitest** (L4): Testing framework with timer mocking

## Test Patterns
- Fake timer usage with `vi.useFakeTimers({shouldAdvanceTime: true})` (L16)
- Mock proxy manager factory injection for session isolation
- Promise.all() for concurrent operation validation (L63)
- Error injection via mock rejection (L162)

## Critical Validations
- Session count verification via `getAllSessions().length` 
- Individual session state checks via `getSession(id)?.state`
- Proxy manager method call counting (`stopCalls`, L129)
- Logger message verification for operational feedback