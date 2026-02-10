# tests/core/unit/session/session-manager-edge-cases.test.ts
@source-hash: c3fffa8836783d32
@generated: 2026-02-10T00:41:22Z

## Purpose

Test suite for SessionManager edge cases and error scenarios, focusing on error handling paths, boundary conditions, and failure modes in debugging session management.

## Test Structure

**Main Test Suite** (L9-304): "SessionManager - Edge Cases and Error Scenarios"
- Tests SessionManager behavior under abnormal conditions
- Validates error handling and recovery mechanisms
- Ensures graceful degradation when operations fail

**Setup/Teardown** (L14-32):
- Uses fake timers for controlled test execution (L15)
- Creates mock dependencies via `createMockDependencies()` (L16)
- Configures standard test SessionManager with `/tmp/test-sessions` log directory (L17-25)
- Resets mocks and timers after each test (L28-32)

## Test Categories

### Session Creation Edge Cases (L34-66)
- **Executable Path Handling** (L35-43): Verifies custom executable paths are preserved
- **Unique ID Generation** (L45-55): Tests concurrent session creation produces unique identifiers
- **Default Naming** (L57-65): Validates auto-generated session names match pattern `/session-[a-f0-9]+/`

### Continue Method Error Handling (L68-87)
- **DAP Request Failures** (L69-86): Tests error propagation when continue DAP requests fail, specifically targeting error handling around line 595 of SessionManager

### DAP Operations Error Scenarios (L89-258)

**getVariables Error Handling**:
- **Network Errors** (L90-112): Tests graceful handling when DAP requests throw exceptions (lines 653-655)
- **Missing Response Body** (L114-136): Validates behavior when response lacks variable data (lines 650-651)

**getStackTrace Error Handling**:
- **Request Failures** (L138-160): Tests timeout/error scenarios (lines 690, 692)
- **Null Response Body** (L162-184): Handles missing stackFrames data (lines 687-688)  
- **Missing Thread ID** (L186-207): Validates behavior when no effective thread ID available

**getScopes Error Handling**:
- **Request Exceptions** (L209-231): Tests invalid frame errors (lines 728-730)
- **Missing Scopes Data** (L233-257): Handles null scopes in response (lines 725-726)

### Session Closing Error Cases (L260-303)
- **Proxy Stop Failures** (L261-281): Tests error handling when proxy.stop() fails (lines 758-762)
- **Non-existent Sessions** (L283-290): Validates behavior when closing invalid session IDs (lines 751-754)
- **Undefined Proxy Handling** (L292-302): Tests closing sessions without active proxies

## Key Dependencies

- **createMockDependencies()**: Provides mock ProxyManager, Logger, and other dependencies
- **SessionManager**: Main class under test from `../../../../src/session/session-manager.js`
- **@debugmcp/shared**: Provides DebugLanguage.MOCK and SessionState enums
- **vitest**: Test framework with mocking capabilities

## Testing Patterns

- **Mock Configuration**: Extensive use of `vi.fn().mockRejectedValue()` and `mockResolvedValue()` to simulate failure conditions
- **State Simulation**: Uses `simulateStopped()` and `simulateEvent()` to create paused debugging states
- **Error Verification**: Validates both return values and logged error messages
- **Async Timer Control**: Uses `vi.runAllTimersAsync()` for deterministic async operations

## Architecture Notes

- All error scenarios test graceful degradation (return empty arrays, log errors)
- Tests reference specific line numbers in SessionManager implementation
- Focuses on edge cases not covered in happy-path testing
- Validates error logging consistency across different failure modes