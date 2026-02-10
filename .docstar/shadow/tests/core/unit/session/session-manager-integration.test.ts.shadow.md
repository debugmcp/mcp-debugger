# tests/core/unit/session/session-manager-integration.test.ts
@source-hash: 0a8746d23335bf33
@generated: 2026-02-09T18:14:25Z

## Purpose
Integration test suite for SessionManager that validates end-to-end behavior across multiple components including event handling, logging, and session persistence.

## Test Structure
The test suite (L9-166) uses Vitest framework with mock dependencies to test SessionManager integration scenarios. Each test group focuses on a specific integration aspect:

### Setup & Teardown (L14-32)
- `beforeEach` (L14-26): Initializes fake timers, mock dependencies, test config with `/tmp/test-sessions` log directory, and creates SessionManager instance
- `afterEach` (L28-32): Restores real timers, clears mocks, and resets proxy manager state

### Event Handling Tests (L34-76)
- **Event forwarding test** (L35-54): Verifies SessionManager correctly processes ProxyManager events (stopped, continued, terminated) and updates session state accordingly
- **Auto-continue test** (L56-75): Tests automatic continuation behavior when `stopOnEntry=false`, validates logger output for auto-continue actions

### Logger Integration Tests (L78-120)
- **Operation logging test** (L79-101): Validates that major operations (session creation, debugging start, session close) are properly logged with expected message patterns
- **Error logging test** (L103-119): Tests error logging when ProxyManager fails to start, verifies error messages are captured

### SessionStore Integration Tests (L122-165)
- **Session persistence test** (L123-144): Verifies multiple sessions are correctly stored and retrievable with proper metadata
- **State update test** (L146-164): Validates that session state changes are persisted in the store with updated timestamps

## Key Dependencies
- `SessionManager` from `../../../../src/session/session-manager.js` (L5)
- `@debugmcp/shared` types: `DebugLanguage`, `SessionState` (L6)
- Mock utilities from `./session-manager-test-utils.js` (L7)

## Test Patterns
- Uses fake timers with `vi.runAllTimersAsync()` to handle asynchronous event processing
- Mock ProxyManager provides `simulateEvent()` method for testing event flows
- Spy pattern on logger methods to verify logging behavior
- State validation through `getSession()` and `getAllSessions()` methods

## Configuration
Test config (L17-23) uses standard DAP launch arguments with `stopOnEntry: true` and `justMyCode: true` as defaults.