# tests/core/unit/session/session-manager-multi-session.test.ts
@source-hash: edaf4a5de47f4b32
@generated: 2026-02-09T18:14:23Z

This test file validates multi-session management capabilities of the SessionManager class, ensuring proper isolation and coordination of concurrent debug sessions.

## Primary Purpose
Tests the SessionManager's ability to handle multiple simultaneous debug sessions, including proper state isolation, concurrent operations, and cleanup mechanisms.

## Key Test Structure
- **Test Suite Setup** (L15-33): Configures mock dependencies, fake timers, and SessionManager instance with test configuration
- **Teardown** (L29-33): Resets timers, mocks, and proxy managers to ensure test isolation

## Core Test Cases

### Multiple Concurrent Sessions (L35-70)
- Creates 3 simultaneous debug sessions with MOCK language
- Validates concurrent session startup and state management
- Verifies each session maintains independent PAUSED state after debugging starts
- Tests Promise.all coordination for parallel session operations

### Session State Isolation (L72-106)  
- Creates separate MockProxyManager instances for different sessions (L74-80)
- Tests that session state changes don't affect other sessions
- Validates proxy manager factory creates distinct instances per session
- Simulates debug events (stopped, continued) on individual sessions

### Bulk Session Management (L108-170)
- **closeAllSessions with Active Sessions** (L108-130): Tests cleanup of multiple active debugging sessions
- **Empty Session List Handling** (L132-142): Validates graceful handling when no sessions exist
- **Error Resilience** (L144-170): Tests that individual session failures don't prevent overall cleanup

## Key Dependencies
- `SessionManager` from `../../../../src/session/session-manager.js` (L5)
- `DebugLanguage, SessionState` from `@debugmcp/shared` (L6)
- `MockProxyManager` for test doubles (L7)
- `createMockDependencies` utility for test setup (L8)

## Testing Patterns
- Uses Vitest fake timers with `shouldAdvanceTime: true` for async operation testing
- Implements mock proxy manager factory pattern for session isolation testing
- Employs Promise.all for testing concurrent operations
- Validates state transitions through direct session state inspection

## Critical Validations
- Session count management and retrieval
- Independent session state maintenance
- Proper proxy manager association per session
- Error handling during bulk operations
- Logging behavior verification for operational visibility