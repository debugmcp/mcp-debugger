# src/cli/sse-command.ts
@source-hash: 2729e94f6af76321
@generated: 2026-02-10T00:41:54Z

## SSE Command Handler for Debug MCP Server

**Primary Purpose**: Implements Server-Sent Events (SSE) transport for the Model Context Protocol (MCP) debug server, enabling HTTP-based bi-directional communication through SSE for server-to-client messages and POST for client-to-server messages.

### Key Interfaces & Types

- **ServerFactoryOptions (L8-11)**: Configuration for server creation with optional logging parameters
- **SSECommandDependencies (L13-17)**: Dependency injection interface containing logger, server factory, and optional exit function  
- **SessionData (L19-22)**: Internal session management structure tracking SSE transport and closing state

### Core Functions

**createSSEApp() (L24-176)**
- Creates Express application with SSE transport capabilities
- Establishes single shared DebugMcpServer instance (L32-35) for all connections 
- Implements session management via Map<string, SessionData> (L39)
- Configures CORS middleware (L42-51) allowing cross-origin requests
- Exposes sseTransports and sharedDebugServer on app object for shutdown access (L172-173)

**handleSSECommand() (L178-228)**  
- Main entry point for SSE mode execution
- Configures logging level and starts Express server on specified port
- Implements graceful shutdown with SIGINT handler (L199-222)
- Coordinates cleanup of SSE connections and shared server

### HTTP Endpoints

**GET /sse (L54-116)**
- Establishes SSE connection using SSEServerTransport
- Connects shared server to new transport instance
- Implements ping mechanism (30s intervals) for connection keepalive (L70-76)
- Handles connection cleanup with recursion protection via isClosing flag (L79-97)
- Manages multiple close event sources (transport.onclose, req close/end)

**POST /sse (L119-159)**
- Handles client-to-server messages
- Validates sessionId from query parameters
- Routes messages through appropriate SSE transport
- Returns JSON-RPC error responses for invalid sessions or errors

**GET /health (L162-169)**
- Health check endpoint exposing connection count and active sessions

### Architectural Patterns

- **Shared Server Model**: Single DebugMcpServer instance serves multiple SSE connections
- **Session-based Transport Management**: Each SSE connection gets unique session ID with dedicated transport
- **Dependency Injection**: Dependencies passed through SSECommandDependencies interface
- **Graceful Shutdown**: Coordinated cleanup of transports and server on SIGINT

### Key Dependencies

- Express.js for HTTP server functionality
- @modelcontextprotocol/sdk/server/sse.js for SSE transport implementation  
- Winston logger for structured logging
- DebugMcpServer from ../server.js as the core MCP server implementation

### Critical Invariants

- Session IDs must be unique and validated before message processing
- Shared server persists across individual SSE connection lifecycles
- Transport cleanup must happen before server shutdown
- isClosing flag prevents infinite recursion in connection cleanup