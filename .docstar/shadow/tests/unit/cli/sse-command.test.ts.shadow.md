# tests/unit/cli/sse-command.test.ts
@source-hash: 5542d388bc48fac8
@generated: 2026-02-10T00:41:36Z

This is a comprehensive unit test file for the SSE (Server-Sent Events) command module of a Debug MCP Server application, using Vitest testing framework.

## Primary Purpose
Tests the SSE mode functionality which enables WebSocket-like communication through HTTP streaming for MCP (Model Context Protocol) servers. The module provides both Express app creation and command handling for SSE transport.

## Key Test Groups and Coverage

### Core Module Testing (L17-856)
Tests two main exported functions:
- `createSSEApp()` - Creates Express application with SSE endpoints
- `handleSSECommand()` - CLI command handler for starting SSE server

### Mock Setup (L8-82)
Comprehensive mocking of dependencies:
- `DebugMcpServer` (L9) - Main server class
- `SSEServerTransport` (L10) - MCP SDK transport layer  
- `express` (L11) - Web framework
- Mock transport with test helpers (`triggerClose`, `triggerError`) (L54-71)

### Express App Creation Tests (L84-156)
- CORS middleware validation (L110-138)
- Route setup verification (`/sse`, `/health`) (L140-148)
- Transport map exposure (L150-155)

### SSE GET Handler Tests (L158-363)
- Connection establishment (L199-219)
- Error handling for server factory and connection failures (L221-240)
- Connection cleanup on close/disconnect events (L242-298) 
- Ping interval functionality with fake timers (L352-362)
- Multiple concurrent connection management (L326-350)

### SSE POST Handler Tests (L365-514)
- Valid session ID handling with message forwarding (L400-416)
- Invalid/missing session ID rejection with JSON-RPC errors (L418-455)
- Transport error handling (L457-513)

### Health Check Endpoint Tests (L516-577)
Returns status with connection count and active session IDs

### Command Handler Tests (L579-797)
- Server startup and configuration (L588-634)
- Port parsing and error handling (L636-689)
- SIGINT graceful shutdown with transport cleanup (L691-747)

## Key Dependencies
- Express.js for HTTP server
- MCP SDK SSEServerTransport for protocol handling
- Winston logger for structured logging
- DebugMcpServer as the underlying MCP server

## Architectural Patterns
- Dependency injection for logger, server factory, and exit function
- Transport session management via Map storage
- Event-driven cleanup with proper listener management
- JSON-RPC error formatting for protocol compliance
- Graceful shutdown handling with resource cleanup

## Testing Utilities
- Custom mock setup with helper methods for event simulation
- Fake timers for ping interval testing
- EventEmitter-based request mocking
- Comprehensive error scenario coverage