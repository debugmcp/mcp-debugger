# tests/core/unit/session/session-manager-multi-session.test.ts
@source-hash: edaf4a5de47f4b32
@generated: 2026-02-10T00:41:12Z

This is a comprehensive test suite for the SessionManager's multi-session management capabilities, ensuring concurrent debugging sessions are properly isolated and managed.

## Purpose
Tests the SessionManager's ability to handle multiple simultaneous debugging sessions with proper state isolation, resource management, and error handling.

## Test Setup (L10-33)
- Uses Vitest framework with mocked dependencies
- Creates fresh SessionManager instance per test with mock configuration (L18-26)
- Configures fake timers for controlled async behavior testing
- Uses createMockDependencies() utility and MockProxyManager for isolation

## Key Test Cases

### Concurrent Session Management (L35-70)
Tests creation and simultaneous operation of multiple debug sessions:
- Creates 3 separate debugging sessions with unique names
- Validates concurrent startDebugging operations across all sessions
- Verifies each session maintains independent PAUSED state

### Session State Isolation (L72-106)
Critical test ensuring proper separation between sessions:
- Creates separate MockProxyManager instances per session (L74-80)
- Tests that state changes in one session don't affect others
- Validates continue operation affects only targeted session while others remain paused

### Bulk Session Management (L108-130)
Tests closeAllSessions() functionality:
- Creates multiple active sessions
- Verifies all sessions transition to STOPPED state
- Confirms proper cleanup through proxy manager stop calls

### Edge Cases
- Empty session list handling in closeAllSessions (L132-142)
- Error resilience during bulk session closure (L144-170)

## Key Dependencies
- SessionManager from `../../../../src/session/session-manager.js`
- DebugLanguage, SessionState from `@debugmcp/shared`
- MockProxyManager and createMockDependencies test utilities

## Testing Patterns
- Extensive use of vi.runAllTimersAsync() for async operation completion
- Promise.all() for concurrent operation testing
- Mock proxy manager simulation for DAP events
- State verification through SessionManager.getSession() calls

The tests ensure the SessionManager can reliably handle multiple concurrent debugging contexts without state leakage or resource conflicts.