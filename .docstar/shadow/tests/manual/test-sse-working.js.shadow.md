# tests/manual/test-sse-working.js
@source-hash: 6639615c06932383
@generated: 2026-02-09T18:15:09Z

## Purpose
Manual test script to validate SSE (Server-Sent Events) connection handling and session management with a local server on port 3001. Tests bidirectional communication flow: SSE for receiving messages and HTTP POST for sending JSON-RPC requests.

## Key Functions

### parseSSEData(chunk) (L10-26)
Parses raw SSE data chunks into structured messages. Splits by newlines, extracts `data:` prefixed lines, and attempts JSON parsing. Returns array of parsed message objects, silently ignoring non-JSON data.

### testPostRequest(sessionId) (L70-122)  
Sends JSON-RPC 2.0 request (`tools/list` method) via HTTP POST to `/sse` endpoint. Uses session ID from SSE connection in `X-Session-ID` header. Logs full request/response cycle including parsed JSON response.

## Main Flow (L29-67)
1. Establishes SSE connection to `http://localhost:3001/sse` with event-stream headers
2. Listens for `connection/established` message containing sessionId
3. Triggers POST request test after 1-second delay once session is established
4. Maintains connection to observe any subsequent SSE messages

## Key Dependencies
- `http` module for HTTP client operations
- Expects server responding with JSON-RPC 2.0 messages over SSE
- Hardcoded to localhost:3001 endpoint

## Architecture Notes
- Session-based communication pattern: SSE establishes session, POST uses session ID
- Graceful JSON parsing with fallback for non-JSON SSE data
- Asynchronous flow with setTimeout coordination between SSE and POST phases
- Script remains running via `process.stdin.resume()` to observe ongoing SSE messages

## Critical Constraints
- Requires server at localhost:3001 with `/sse` endpoint supporting both SSE and POST
- Depends on specific message format: `{method: 'connection/established', params: {sessionId: string}}`
- Uses JSON-RPC 2.0 protocol structure for POST requests