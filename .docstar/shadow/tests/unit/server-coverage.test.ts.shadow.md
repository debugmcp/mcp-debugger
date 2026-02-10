# tests/unit/server-coverage.test.ts
@source-hash: e616cf65d25fe01a
@generated: 2026-02-10T00:42:05Z

## Test Coverage Suite for DebugMcpServer Error Paths and Edge Cases

**Purpose**: Comprehensive unit test suite targeting error conditions, edge cases, and boundary scenarios in the DebugMcpServer to maximize test coverage beyond happy-path scenarios.

**Test Structure**:
- Uses Vitest testing framework with extensive mocking
- Main test setup (L16-61) creates mock logger and session manager with full method stubs
- Mock session manager provides controlled responses for all debugging operations
- Test cleanup (L63-65) ensures mock isolation between tests

**Key Test Categories**:

### Session Validation Tests (L67-84)
- Tests session not found scenarios (L68-73)
- Tests operations on terminated sessions (L75-83)
- Validates proper McpError throwing for invalid session states

### Debugging Operation Error Paths (L86-168)
- **Step Operations**: stepOver (L87-100), stepInto (L102-115), stepOut (L117-130)
- **Continue Execution**: Tests process termination scenarios (L132-145)
- **Stack Trace Edge Cases**: Missing proxy manager (L147-156), missing thread ID (L158-167)
- All operations test failure responses from session manager with specific error messages

### Session Creation Edge Cases (L170-215)
- Port allocation failures (L171-178)
- Language support validation in different environments (L180-191)
- Container mode behavior allowing Python even when not in adapter list (L193-214)

### Debugging Start Scenarios (L217-255)
- File existence validation with mocked fileChecker (L218-235)
- Debugger launch failures (L237-254)
- Tests both file not found and debugger startup errors

### Breakpoint Setting Edge Cases (L257-294)
- File validation for breakpoint locations (L258-274)
- Invalid line number handling (L276-293)
- Uses same fileChecker pattern as debugging start tests

### Server Lifecycle Management (L296-323)
- Server start/stop operations (L297-315)
- Session cleanup during shutdown with failure scenarios
- Adapter registry access (L318-322)

### Language Discovery Fallback Logic (L325-360)
- Dynamic language discovery failure handling (L326-336)
- Missing registry fallback to defaults (L338-345)
- Container mode Python injection (L347-359)

### Success Path Validation (L362-416)
- Validates proper operation when session manager succeeds
- Tests session listing functionality (L388-409)
- Pause operation error surfacing (L411-415)

### Error Recovery Patterns (L418-477)
- Session name retrieval with graceful degradation (L418-434)
- Variables/scopes error propagation (L436-460)
- Expression evaluation in terminated sessions (L462-477)

**Architecture Patterns**:
- Extensive use of mock injection via `(server as any).sessionManager`
- Environment variable manipulation for container mode testing
- FileChecker abstraction for file system operations
- Standardized error response patterns across all operations

**Dependencies**:
- `@modelcontextprotocol/sdk/types.js` for McpError and error codes
- `@debugmcp/shared` for SessionLifecycleState enum
- Vitest for mocking and test framework capabilities

**Critical Test Behaviors**:
- All async operations properly await and use expect().rejects.toThrow()
- Mock setup ensures predictable failure scenarios
- Environment restoration after container mode tests
- Session state validation before operations