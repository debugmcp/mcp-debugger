# tests\core\unit\server\server-lifecycle.test.ts
@source-hash: 2bbca6a7e9cee539
@generated: 2026-02-21T08:28:09Z

## Purpose
Unit test suite for testing the server lifecycle of DebugMcpServer, specifically covering startup and shutdown scenarios with comprehensive mocking of dependencies.

## Test Structure
- **Main describe block**: "Server Lifecycle Tests" (L23-99) - Contains all server lifecycle tests
- **beforeEach setup** (L29-41): Establishes comprehensive mock environment with dependencies, server, transport, and session manager
- **afterEach cleanup** (L43-45): Clears all mocks between tests

## Key Dependencies & Mocks
- **@modelcontextprotocol/sdk**: Server and StdioServerTransport classes (L5-6, L18-19)
- **DebugMcpServer**: Main server class under test (L7)
- **SessionManager**: Session management functionality (L8, L20)
- **Dependencies container**: Production dependency creation (L9, L21)
- **Test helpers**: Mock creation utilities (L11-15)

## Test Categories

### Server Start Tests (L47-63)
- **Basic startup test** (L48-54): Verifies server starts with stdio transport and logs appropriately
- **Repeated startup test** (L56-62): Ensures server can handle multiple start invocations

### Server Stop Tests (L65-98)
- **Clean shutdown** (L66-74): Tests normal server stop with session cleanup and logging
- **Session close error handling** (L76-87): Verifies error propagation when session cleanup fails
- **Server close error handling** (L89-97): Tests error handling during server shutdown

## Test Patterns
- Uses comprehensive mocking strategy with vi.mock for all external dependencies
- Each test creates fresh DebugMcpServer instance for isolation
- Mock expectations verify both functional behavior and logging output
- Error scenarios test exception propagation and cleanup attempts

## Mock Setup Architecture
- Mock dependencies created via createMockDependencies helper
- Server SDK components mocked with createMockServer/createMockStdioTransport
- SessionManager mocked with adapter registry integration
- All mocks configured in beforeEach for consistent test environment