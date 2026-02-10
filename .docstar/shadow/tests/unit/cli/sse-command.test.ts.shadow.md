# tests/unit/cli/sse-command.test.ts
@source-hash: 5542d388bc48fac8
@generated: 2026-02-09T18:14:51Z

## Primary Purpose
Comprehensive unit test suite for the SSE (Server-Sent Events) command handler module. Tests the creation of Express SSE applications, connection management, route handling, and graceful shutdown behaviors.

## Test Structure

### Main Test Suites
- **createSSEApp tests (L84-156)**: Tests Express app creation with CORS middleware, SSE routes, and health checks
- **GET /sse route handler tests (L158-363)**: Tests SSE connection establishment, transport management, error handling, and cleanup
- **POST /sse route handler tests (L365-514)**: Tests message handling for established SSE sessions
- **Health check endpoint tests (L516-577)**: Tests health status reporting
- **handleSSECommand tests (L579-797)**: Tests main command entry point, server startup, and graceful shutdown
- **Server factory options tests (L799-831)**: Tests option passing to server factory
- **Transport event assignment tests (L833-856)**: Tests event handler assignment

### Key Mock Setup (L25-82)
- Mock logger with standard logging methods (L27-33)
- Mock DebugMcpServer with start/stop/connect methods (L36-42)
- Mock SSEServerTransport with transport lifecycle methods (L54-71)
- Mock Express app with standard HTTP methods (L88-98)

## Critical Test Scenarios

### Connection Management
- **SSE connection establishment (L199-219)**: Tests successful transport creation, server connection, and ping intervals
- **Multiple concurrent connections (L326-350)**: Tests concurrent session handling and selective cleanup
- **Connection cleanup (L242-278)**: Tests proper cleanup on transport close and client disconnect events
- **Recursive close prevention (L280-298)**: Tests protection against multiple cleanup calls

### Error Handling
- **Server factory errors (L221-228)**: Tests error propagation from server creation
- **Connection errors (L230-240)**: Tests handling of server connection failures
- **Transport errors (L300-311)**: Tests transport-level error handling
- **Headers already sent (L313-324)**: Tests response handling when headers are already sent

### Session Management
- **Valid session handling (L400-416)**: Tests message routing to existing sessions
- **Invalid session rejection (L418-442, L444-455)**: Tests validation and error responses for invalid sessions
- **Session ID validation**: Tests both missing and invalid session ID scenarios

### Graceful Shutdown
- **SIGINT handling (L691-747)**: Tests complete shutdown sequence including transport cleanup and server stopping
- **Process exit handling (L749-767)**: Tests fallback to process.exit when custom exit function not provided

## Dependencies
- **Vitest**: Test framework with mocking capabilities
- **Express**: Web framework for SSE server
- **@modelcontextprotocol/sdk**: MCP protocol SSE transport
- **Winston Logger**: Logging interface
- **DebugMcpServer**: Main server implementation from `../../../src/server.js`
- **EventEmitter**: Node.js events for request mocking

## Test Utilities
- **setupGetRoute helper (L159-197)**: Creates isolated test environment for GET route testing
- **Mock transport with test helpers (L62-67)**: Provides `triggerClose()` and `triggerError()` methods for event simulation
- **Timer mocking**: Uses fake timers for testing ping intervals and timeouts

## Architecture Patterns
- Extensive use of dependency injection for testability (logger, serverFactory, exitProcess)
- Event-driven architecture testing with proper cleanup verification
- Comprehensive error boundary testing for all failure scenarios
- Session lifecycle management with concurrent connection support