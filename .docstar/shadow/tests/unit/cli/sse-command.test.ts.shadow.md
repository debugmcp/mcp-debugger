# tests\unit\cli\sse-command.test.ts
@source-hash: 60e5913a47068ddd
@generated: 2026-02-24T21:14:38Z

## Purpose
Comprehensive test suite for the SSE (Server-Sent Events) command handler functionality, testing Express app creation, route handling, connection management, and graceful shutdown procedures.

## Test Structure
- **Main Test Suite** (L17-858): `SSE Command Handler` covers all SSE functionality
- **Mock Setup** (L25-82): Extensive mock configuration for logger, server, transport, and process handlers
- **Test Categories**:
  - `createSSEApp` tests (L84-156): Express app creation and middleware setup
  - GET `/sse` route tests (L158-363): Connection establishment and lifecycle
  - POST `/sse` route tests (L365-514): Message handling and session validation  
  - Health endpoint tests (L516-577): Status reporting
  - `handleSSECommand` tests (L579-798): Full command execution and error handling

## Key Test Functions
- **setupGetRoute()** (L159-197): Helper to isolate GET route handler testing with mock Express setup
- **Mock Transport Creation** (L54-71): Creates mock SSE transport with test helper methods `triggerClose()` and `triggerError()`
- **Signal Handler Testing** (L692-748): Tests SIGINT graceful shutdown with session cleanup

## Mock Dependencies
- **DebugMcpServer** (L5,9): Mocked MCP server with start/stop/connect methods
- **SSEServerTransport** (L10,14-15): Mocked transport layer with message handling
- **Express** (L2,11): Mocked Express framework for HTTP server functionality
- **Winston Logger** (L4,18): Mocked logging interface

## Critical Test Scenarios
- **Connection Management**: Multiple concurrent connections (L326-350), session cleanup on disconnect
- **Error Handling**: Server connection failures (L230-240), transport errors (L300-311), invalid session IDs (L418-442)
- **CORS Middleware**: OPTIONS request handling (L110-138) with proper headers
- **Graceful Shutdown**: SIGINT handling with transport cleanup and server stop (L692-748)
- **Health Monitoring**: Connection counting and session tracking (L545-576)

## Test Utilities
- **Fake Timers**: Used for ping interval testing (L201,354) to verify keepalive functionality
- **Event Emitter Mocking**: Request objects extend EventEmitter for disconnect simulation (L178-181)
- **Process Signal Mocking**: Captures and tests SIGINT handlers (L712-716)

## Architecture Patterns
- Dependency injection through options objects for logger, serverFactory, exitProcess
- Session-based transport management with Map storage
- Event-driven connection lifecycle with proper cleanup
- JSON-RPC error response formatting for invalid requests