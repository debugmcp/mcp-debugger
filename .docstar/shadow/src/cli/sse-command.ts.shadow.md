# src\cli\sse-command.ts
@source-hash: c6dca3cddff348f0
@generated: 2026-02-24T18:26:36Z

## Purpose
Implements Server-Sent Events (SSE) transport layer for MCP (Model Context Protocol) server, enabling bidirectional communication through HTTP with persistent connections.

## Core Architecture

### Express Application Factory
**`createSSEApp` (L24-176)** - Creates Express app with SSE endpoints and shared MCP server instance. Key features:
- Single shared `DebugMcpServer` instance serves all connections (L32-36)
- Session-based transport management via `Map<string, SessionData>` (L39)
- CORS middleware for cross-origin requests (L42-51)

### SSE Protocol Implementation
**GET `/sse` endpoint (L54-116)** - Establishes server-to-client event stream:
- Creates `SSEServerTransport` and connects to shared MCP server (L57-60)
- Implements periodic ping mechanism every 30 seconds (L70-76)
- Robust connection cleanup with recursion guards (L79-97)

**POST `/sse` endpoint (L119-159)** - Handles client-to-server messages:
- Session validation via query parameter `sessionId` (L122-140)
- Routes messages through existing transport instance (L142-145)
- JSON-RPC error responses for invalid sessions (L131-138)

### Command Handler
**`handleSSECommand` (L178-233)** - Main entry point that:
- Configures logging and starts HTTP server on specified port (L184-201)
- Implements graceful shutdown with SIGINT handling (L204-227)
- Properly cleans up all SSE connections and shared server instance

## Key Dependencies
- `@modelcontextprotocol/sdk/server/sse.js` - SSE transport implementation
- `../server.js` - DebugMcpServer for MCP protocol handling
- `./setup.js` - SSEOptions configuration interface

## Critical Design Patterns
1. **Shared Server Architecture** - Single MCP server instance handles all concurrent SSE connections, improving resource efficiency
2. **Session Management** - Each SSE connection gets unique session ID for message routing
3. **Connection Persistence** - Ping mechanism and proper cleanup prevent zombie connections
4. **Graceful Shutdown** - Orderly cleanup of all resources during process termination

## Health Monitoring
**`/health` endpoint (L162-169)** provides connection status and active session count for operational monitoring.