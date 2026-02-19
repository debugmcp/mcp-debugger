# tests\core\unit\session\session-manager-state.test.ts
@source-hash: 8c120dea8bc0681a
@generated: 2026-02-19T23:47:33Z

**Purpose**: Unit tests for SessionManager's state machine integrity, ensuring proper state transitions and error handling.

**Test Setup** (L10-33):
- Uses vitest testing framework with mocked timers and dependencies
- Creates SessionManager instance with mock dependencies for isolated testing
- Configures test environment with fake timers and cleanup procedures

**Key Test Cases**:

1. **Valid State Transitions Test** (L35-60):
   - Tests complete lifecycle: CREATED → INITIALIZING → PAUSED → RUNNING → STOPPED
   - Verifies stopOnEntry behavior causes immediate pause after initialization
   - Simulates DAP events through mock proxy manager
   - Confirms session removal from store after close

2. **Invalid Operation Rejection Test** (L62-86):
   - Tests that operations are properly rejected based on current state
   - Validates ProxyNotRunningError thrown for operations on non-started sessions
   - Checks error responses for invalid state operations (stepping when running, continuing when not paused)
   - Uses both exception-based and result-based error handling patterns

3. **State Consistency During Errors Test** (L88-106):
   - Ensures state machine maintains integrity when runtime errors occur
   - Verifies transition to ERROR state and cleanup of proxy manager reference
   - Tests that continued events don't automatically change state without explicit transitions

**Dependencies**:
- SessionManager from main source (L5)
- DebugLanguage and SessionState enums from shared package (L6)
- Mock utilities for dependency injection (L7)
- Custom error types for proper error handling (L8)

**Testing Patterns**:
- Comprehensive state machine validation with explicit state assertions
- Event simulation through mock proxy manager
- Timer-based async operation testing with fake timers
- Mixed error handling validation (exceptions vs result objects)