# tests/unit/server-coverage.test.ts
@source-hash: e616cf65d25fe01a
@generated: 2026-02-09T18:15:17Z

## Purpose
Comprehensive test suite for server.ts error handling and edge cases to improve test coverage. Focuses on testing failure paths, error conditions, and boundary scenarios that may not be covered by standard happy-path tests.

## Test Structure
- **Main Test Suite (L11-478)**: "Server Coverage - Error Paths and Edge Cases" - orchestrates all coverage tests
- **Setup/Teardown (L16-65)**: Creates mock DebugMcpServer with mocked dependencies (sessionManager, logger) before each test
- **Mock Configuration (L32-60)**: Comprehensive mock setup for sessionManager with all required methods and adapterRegistry

## Key Test Categories

### Session Validation Edge Cases (L67-84)
- Tests session not found scenarios (L68-73)
- Tests terminated session handling (L75-83)
- Validates proper McpError throwing for invalid session states

### Tool Operation Error Handling (L86-168)
- **Step Operations (L87-130)**: Tests stepOver, stepInto, stepOut failure scenarios with specific error messages
- **Continue Execution (L132-145)**: Tests process termination during continue operations
- **Stack Trace Edge Cases (L147-167)**: Tests missing proxy manager and null current thread scenarios

### Debug Session Creation (L170-215)
- Tests session creation failures (L171-178)
- **Language Support Validation (L180-214)**: Tests unsupported language handling in non-container vs container modes
- Environment variable manipulation for MCP_CONTAINER testing

### Debugging Lifecycle (L217-255)
- **File Validation (L218-235)**: Tests file not found scenarios using mocked fileChecker
- **Debugger Launch Failures (L237-254)**: Tests debugging start failures with proper error propagation

### Breakpoint Management (L257-294)
- File existence validation for breakpoint targets (L258-274)
- Breakpoint setting failure handling (L276-293)

### Server Lifecycle (L296-316)
- Server start/stop operations (L297-309)
- Session cleanup failure handling during shutdown (L311-315)

### Language Discovery (L325-360)
- Dynamic language discovery fallback mechanisms (L326-336)
- Default language handling when registry unavailable (L338-345)
- Container mode Python injection (L347-359)

### Success Path Coverage (L362-416)
- Validates successful execution flows to ensure proper positive case handling
- Session listing functionality (L388-409)
- Pause operation standardized error response (L411-415)

## Key Dependencies
- **vitest**: Testing framework with mocking capabilities
- **DebugMcpServer**: Main server class under test from '../../src/server'
- **@modelcontextprotocol/sdk**: McpError and ErrorCode types
- **@debugmcp/shared**: SessionLifecycleState enum

## Testing Patterns
- Extensive use of vi.fn() mocks for all external dependencies
- Mock return value chaining for different test scenarios
- Environment variable manipulation with proper cleanup
- Error boundary testing with expect().rejects.toThrow()
- Private method testing via (server as any) type assertion

## Critical Test Coverage Areas
- Session state validation and lifecycle management
- File system interaction error handling
- Debugger proxy manager edge cases
- Language adapter registry fallback mechanisms
- Server startup/shutdown cleanup procedures