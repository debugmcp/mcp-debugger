# tests/core/unit/server/server-lifecycle.test.ts
@source-hash: 8b6269ea912ad720
@generated: 2026-02-10T01:18:54Z

## Purpose
Unit test suite for DebugMcpServer lifecycle management using Vitest, focusing on server start/stop operations and error handling scenarios.

## Test Structure
- **Main test suite** (L23): "Server Lifecycle Tests" with comprehensive mocking setup
- **BeforeEach setup** (L29-41): Configures mock dependencies, Server SDK, StdioServerTransport, and SessionManager
- **AfterEach cleanup** (L43-45): Clears all mocks between tests

## Key Test Groups

### Server Start Tests (L47-63)
- **Basic start test** (L48-54): Verifies server starts successfully with stdio transport and logs startup message
- **Error handling test** (L56-62): Tests server start error scenarios (though implementation appears incomplete)

### Server Stop Tests (L65-98)
- **Clean stop test** (L66-74): Verifies server stops gracefully, closes all sessions, and logs shutdown message
- **Session close error test** (L76-87): Tests error propagation when SessionManager.closeAllSessions fails
- **Server close error test** (L89-97): Tests server shutdown with session cleanup success

## Dependencies & Mocking
- **External mocks** (L18-21): Server SDK, StdioServerTransport, SessionManager, and production dependencies
- **Test helpers** (L11-15): Custom mock factories from server-test-helpers.js
- **Mock objects** (L24-27): debugServer (SUT), mockServer, mockSessionManager, mockDependencies

## Key Patterns
- Comprehensive mocking strategy using Vitest vi.mock()
- Dependency injection testing through createProductionDependencies mock
- Error scenario testing with promise rejection handling
- Consistent assertion patterns for logger calls and method invocations

## Critical Test Coverage
- Server lifecycle state transitions (start/stop)
- Error propagation from dependency failures  
- Resource cleanup verification (session closure)
- Logging behavior validation