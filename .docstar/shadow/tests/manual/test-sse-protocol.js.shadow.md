# tests/manual/test-sse-protocol.js
@source-hash: a677ad0e427e54c4
@generated: 2026-02-10T00:41:59Z

## Purpose
Manual test script for SSE (Server-Sent Events) connection handling with MCP SDK protocol integration. Tests bi-directional communication via SSE endpoint establishment and subsequent JSON-RPC POST requests.

## Key Components

### Constants & Configuration
- `SSE_URL` (L4): Target endpoint `http://localhost:3001/sse` for SSE connection
- Default headers (L30-32): Standard SSE client headers with cache control

### Core Functions

#### `parseSSEEvents(chunk)` (L9-26)
Parses raw SSE data chunks into structured event objects. Handles SSE protocol format:
- Extracts `event:` and `data:` fields from incoming chunks
- Returns array of parsed events with event type and data content
- Manages event boundary detection via empty lines

#### `testPostRequest(sessionId)` (L75-120)
Executes JSON-RPC POST request using extracted session ID:
- Sends `tools/list` method call with JSON-RPC 2.0 format
- Includes session ID in `X-Session-ID` header for correlation
- Logs complete request/response cycle for debugging

### Protocol Flow

#### SSE Connection Establishment (L29-68)
1. Initiates HTTP GET request to SSE endpoint with proper headers
2. Monitors for `endpoint` events containing session information
3. Extracts session ID via regex pattern `/sessionId=([a-f0-9-]+)/` (L51)
4. Triggers POST request after 1-second delay (L57-59)

#### Session Management
- Session ID extraction from SSE endpoint event data (L51-54)
- Session correlation via `X-Session-ID` header in subsequent requests (L92)

## Dependencies
- `http` module for raw HTTP client operations
- No external MCP SDK imports (manual protocol implementation)

## Architecture Notes
- Implements manual SSE parsing instead of using EventSource API
- Follows MCP SDK SSE protocol pattern with session-based communication
- Maintains persistent SSE connection while testing POST operations
- Uses setTimeout for connection sequencing rather than promise chains

## Critical Behaviors
- Script keeps running indefinitely via `process.stdin.resume()` (L123) to observe ongoing SSE events
- Expects specific SSE event format with `endpoint` event type for session establishment
- POST request uses same endpoint (`/sse`) as SSE connection for protocol consistency