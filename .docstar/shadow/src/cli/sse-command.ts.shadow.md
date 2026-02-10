# src/cli/sse-command.ts
@source-hash: 2729e94f6af76321
@generated: 2026-02-09T18:15:05Z

## Purpose and Responsibility
Creates Express.js application for Server-Sent Events (SSE) transport of Model Context Protocol (MCP) communications. Implements a shared debug server model where all SSE connections use the same MCP server instance while maintaining separate transport sessions.

## Key Interfaces and Types
- `ServerFactoryOptions` (L8-11): Configuration for MCP server creation with optional logging parameters
- `SSECommandDependencies` (L13-17): Dependency injection interface for logger, server factory, and process exit function
- `SessionData` (L19-22): Tracks SSE transport instance and closing state per session

## Primary Functions

### createSSEApp (L24-176)
Creates the Express application with SSE endpoints. Uses single shared DebugMcpServer instance (L32-35) for all connections to maintain state persistence across sessions. Manages active transports in Map by sessionId (L39).

**Endpoints:**
- `GET /sse` (L54-116): Establishes SSE connection with automatic ping keep-alive (L70-76). Implements connection cleanup with recursion guards (L79-97)
- `POST /sse` (L119-159): Handles client-to-server messages, validates session ID from query params (L122-140) 
- `GET /health` (L162-169): Status endpoint showing connection count and active sessions

**CORS Configuration:** Allows all origins with specific headers including X-Session-ID (L42-51).

### handleSSECommand (L178-228)
Entry point that configures logging, starts Express server on specified port, and implements graceful shutdown handling (L199-222). Cleanup includes closing all SSE transports and stopping shared server instance.

## Key Dependencies
- `@modelcontextprotocol/sdk/server/sse.js`: SSEServerTransport for MCP-over-SSE protocol
- `../server.js`: DebugMcpServer for MCP functionality
- `./setup.js`: SSEOptions configuration type

## Architectural Patterns
- **Shared Server Model**: Single MCP server instance serves all SSE connections to maintain state consistency
- **Session Management**: Transport lifecycle tied to sessionId with cleanup guards to prevent resource leaks
- **Graceful Degradation**: Error handling preserves server stability when individual connections fail

## Critical Invariants
- One MCP server instance per application lifetime, multiple transports per server
- Session cleanup must prevent infinite recursion via isClosing flag
- Transport cleanup should NOT affect shared server instance (L94-96)
- POST endpoint requires valid sessionId matching active transport