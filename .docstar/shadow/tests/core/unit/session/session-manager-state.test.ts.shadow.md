# tests/core/unit/session/session-manager-state.test.ts
@source-hash: e235bed449d199c5
@generated: 2026-02-09T18:14:22Z

**Purpose**: Unit tests validating the SessionManager's state machine behavior and transition enforcement. Ensures proper state flow and error handling during debug session lifecycle.

**Test Structure**:
- Test suite setup (L10-33) with mocked dependencies and fake timers for deterministic async testing
- Uses `createMockDependencies()` to isolate SessionManager from external systems
- Configuration includes default DAP launch args with `stopOnEntry: true` (L18-24)

**Key Test Cases**:

**Valid State Transitions (L35-60)**:
- Tests complete session lifecycle: CREATED → INITIALIZING → PAUSED → RUNNING → STOPPED
- Validates stopOnEntry behavior causes automatic pause after initialization (L48-49)
- Uses `mockProxyManager.simulateEvent()` to trigger state changes (L54)

**Invalid Operations Rejection (L62-86)**:
- Verifies operations throw `ProxyNotRunningError` when session not started (L69)
- Tests operation failures return structured error responses with `success: false` and `error` message (L78-85)
- Validates state-dependent operation restrictions (stepping when running, continuing when not paused)

**Error State Consistency (L88-106)**:
- Tests error handling maintains proper state transitions
- Simulates runtime errors and validates transition to ERROR state (L101-104)
- Confirms cleanup behavior (proxyManager becomes undefined on error, L105)

**Dependencies**:
- SessionManager from main source with SessionManagerConfig interface
- DebugLanguage and SessionState enums from @debugmcp/shared
- ProxyNotRunningError for typed error handling
- Mock utilities for dependency injection and test isolation

**Testing Patterns**:
- Async/await with fake timers using `vi.runAllTimersAsync()` for deterministic timing
- Mock event simulation for external system interactions
- State assertion after each transition to verify integrity
- Structured error response validation with success/error fields