# tests/core/unit/session/session-manager-integration.test.ts
@source-hash: 0a8746d23335bf33
@generated: 2026-02-10T00:41:17Z

**Purpose**: Integration test suite for SessionManager, validating cross-component behavior including event handling, logging, and session persistence.

**Test Structure**:
- Main setup in `beforeEach` (L14-26): Creates mock dependencies, configures SessionManager with test config
- Cleanup in `afterEach` (L28-32): Restores timers, clears mocks, resets proxy manager

**Key Test Categories**:

### Event Handling Tests (L34-76)
- **Event forwarding test** (L35-54): Validates ProxyManager event propagation affects session state correctly
  - Creates session → starts debugging → simulates stopped/continued/terminated events
  - Verifies state transitions: RUNNING → PAUSED → STOPPED
  - Tests edge case: continued events while paused don't change state back to running (L48-50)
- **Auto-continue test** (L56-75): Tests `stopOnEntry=false` behavior
  - Simulates entry stop event and verifies auto-continue logging

### Logger Integration Tests (L78-120) 
- **Operation logging** (L79-101): Verifies all major operations are logged (create, start debugging, close)
- **Error logging** (L103-119): Tests error scenarios with `shouldFailStart` flag, validates error message format

### SessionStore Integration Tests (L122-165)
- **Session persistence** (L123-144): Creates multiple sessions, verifies proper storage and retrieval
- **State updates** (L146-164): Tests session state transitions update the store with proper timestamps

**Dependencies**:
- SessionManager from `src/session/session-manager.js` (L5)
- Mock dependencies via `createMockDependencies()` (L7, L16)
- Uses vitest fake timers for time-based testing (L15, L29)

**Test Patterns**:
- Consistent session creation with DebugLanguage.MOCK
- Heavy use of mock dependencies for isolation
- Timer manipulation for async event testing (`vi.runAllTimersAsync()`)
- Spy-based verification for logging behavior

**Key Configuration**:
- Test config uses `/tmp/test-sessions` log directory (L18)
- Default DAP launch args: `stopOnEntry: true`, `justMyCode: true` (L19-22)