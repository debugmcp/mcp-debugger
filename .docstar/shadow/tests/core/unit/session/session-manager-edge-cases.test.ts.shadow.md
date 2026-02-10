# tests/core/unit/session/session-manager-edge-cases.test.ts
@source-hash: c3fffa8836783d32
@generated: 2026-02-09T18:14:24Z

## Purpose
Edge case and error scenario test suite for `SessionManager`, focusing on error handling paths, boundary conditions, and graceful degradation behaviors.

## Test Structure
The test file is organized into 4 main test groups:

### Session Creation Edge Cases (L34-66)
- **Executable path handling** (L35-43): Verifies custom executable paths are preserved in managed sessions
- **Unique ID generation** (L45-55): Ensures concurrent session creation produces unique identifiers
- **Default naming** (L57-65): Tests automatic session name generation when not provided

### Continue Method Error Handling (L68-87)
- **DAP request failure handling** (L69-86): Tests exception propagation when continue DAP requests fail

### DAP Operations Error Handling (L89-258)
Comprehensive error handling tests for core DAP operations:

- **getVariables error scenarios** (L90-136):
  - Network/request failures return empty array and log errors (L90-112)
  - Missing response body handling with warnings (L114-136)

- **getStackTrace error scenarios** (L138-207):
  - Request failures return empty array and log errors (L138-160)
  - Null response body handling (L162-184)
  - Missing thread ID scenarios (L186-207)

- **getScopes error scenarios** (L209-257):
  - Request failures return empty array and log errors (L209-231)
  - Missing scopes in response handling (L233-257)

### Session Closing Error Cases (L260-303)
- **Proxy stop failures** (L261-281): Tests graceful handling when proxy.stop() throws errors
- **Non-existent session closure** (L283-290): Verifies false return and warning for invalid session IDs
- **Undefined proxy handling** (L292-302): Tests closure of sessions without active proxies

## Key Dependencies
- **SessionManager** from `session/session-manager.js` - Main class under test
- **Mock utilities** from `session-manager-test-utils.js` - Provides `createMockDependencies()` helper
- **Vitest framework** - Testing infrastructure with timer mocking capabilities
- **@debugmcp/shared** - Provides `DebugLanguage` and `SessionState` enums

## Test Patterns
- Uses fake timers for deterministic async behavior testing
- Employs mock dependency injection through `createMockDependencies()`
- Simulates DAP protocol failures by mocking `sendDapRequest` rejections
- Tests both exception propagation and graceful degradation patterns
- Validates logging behavior for error scenarios

## Configuration
Standard test configuration uses:
- Base log directory: `/tmp/test-sessions`
- Default DAP launch args: `stopOnEntry: true, justMyCode: true`
- Mock language type for consistent test behavior