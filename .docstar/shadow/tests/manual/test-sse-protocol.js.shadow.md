# tests/manual/test-sse-protocol.js
@source-hash: a677ad0e427e54c4
@generated: 2026-02-09T18:15:09Z

**Manual test script for MCP SDK SSE (Server-Sent Events) protocol implementation**

This is a Node.js test client that validates the SSE-based communication protocol used by the MCP (Model Context Protocol) SDK, specifically testing the two-phase connection pattern: initial SSE endpoint discovery followed by authenticated JSON-RPC communication.

## Primary Components

### SSE Event Parser (L8-26)
- **parseSSEEvents()**: Parses raw SSE chunk data into structured event objects
- Handles standard SSE format: `event:` and `data:` lines separated by newlines
- Returns array of parsed events with `{event, data}` structure

### Main SSE Connection (L28-68)
- Establishes GET request to `http://localhost:3001/sse` with proper SSE headers
- Listens for `endpoint` events containing session information
- Extracts session ID using regex pattern `/sessionId=([a-f0-9-]+)/` (L51)
- Triggers POST request test after 1-second delay when session ID obtained

### POST Request Handler (L74-120)
- **testPostRequest(sessionId)**: Sends JSON-RPC 2.0 request to same endpoint
- Uses session ID in `X-Session-ID` header for authentication
- Sends `tools/list` method call as test payload
- Maintains SSE connection to receive potential responses

## Protocol Flow

1. **Discovery Phase**: Client connects via SSE to receive endpoint/session information
2. **Authentication Phase**: Client uses extracted session ID for subsequent API calls
3. **Communication Phase**: Standard JSON-RPC 2.0 over HTTP POST with session authentication

## Key Dependencies
- Node.js `http` module for both SSE and POST requests
- Hardcoded endpoint: `localhost:3001/sse`
- Expects MCP SDK SSE protocol with session-based authentication

## Architectural Notes
- Keeps process alive with `process.stdin.resume()` (L123) for continuous testing
- Designed for manual testing/debugging of SSE protocol implementation
- Follows standard SSE client patterns with proper error handling
- Tests both phases of MCP SDK connection protocol in sequence