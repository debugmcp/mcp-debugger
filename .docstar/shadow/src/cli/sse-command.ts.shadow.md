# src\cli\sse-command.ts
@source-hash: 67323bc8080eba36
@generated: 2026-02-24T21:14:37Z

Express application setup and command handler for SSE (Server-Sent Events) transport mode in a Debug MCP Server. Implements HTTP-based bidirectional communication using SSE for server-to-client and POST for client-to-server messages.

## Core Architecture

**createSSEApp (L24-176)**: Factory function that creates an Express application with three main endpoints:
- `/sse` GET endpoint for establishing SSE connections 
- `/sse` POST endpoint for handling client messages
- `/health` endpoint for connection status monitoring

**Session Management**: Uses a Map<string, SessionData> (L39) to track active SSE transports by session ID. Each SessionData (L19-22) contains the transport instance and closing state flag.

**Shared Server Pattern**: Creates a single DebugMcpServer instance (L32-35) that persists across all SSE connections, unlike per-connection server instances.

## Key Components

**SSECommandDependencies (L13-17)**: Dependency injection interface requiring logger, serverFactory, and optional exitProcess function.

**ServerFactoryOptions (L8-11)**: Configuration interface for log level and file options.

**CORS Middleware (L42-51)**: Handles cross-origin requests with wildcard origin policy and preflight OPTIONS requests.

**Connection Lifecycle**:
- SSE establishment connects shared server to transport (L60)
- Periodic ping messages every 30 seconds maintain connection (L70-76)
- Close handler with recursion protection prevents duplicate cleanup (L79-97)
- Transport cleanup preserves shared server for other connections

**handleSSECommand (L178-242)**: Main command entry point that:
- Configures logger level
- Creates and starts Express app
- Starts shared DebugMcpServer
- Sets up HTTP server with error handling
- Implements graceful shutdown with SIGINT handler

## Error Handling

Comprehensive error handling for:
- SSE connection establishment failures (L110-115)
- Invalid session ID validation (L124-140) 
- POST message processing errors (L147-158)
- Server startup errors (L203-210)
- Port binding conflicts (EADDRINUSE)

## Notable Patterns

**Transport Exposure**: App instance stores sseTransports and sharedDebugServer as properties (L172-173) for external access during shutdown.

**JSON-RPC Error Responses**: POST endpoint returns standard JSON-RPC 2.0 error format with appropriate error codes (-32600 for invalid requests, -32603 for internal errors).

**Session Validation**: POST requests require sessionId query parameter matching an active SSE connection.

**Graceful Shutdown**: SIGINT handler closes all transports, stops shared server, and cleanly exits.