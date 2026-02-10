# tests/manual/test-sse-connection.js
@source-hash: 06e15248914f92c7
@generated: 2026-02-10T00:41:53Z

## Purpose
Manual test script for Server-Sent Events (SSE) connection testing against a local server. Validates SSE connectivity, session establishment, and bidirectional communication via SSE + HTTP POST.

## Key Components

**SSE Connection Setup (L7-11)**
- Creates EventSource connection to `http://localhost:3001/sse`
- Logs connection establishment

**Message Handler (L13-49)**
- Processes incoming SSE messages with JSON parsing
- Extracts session ID from `connection/established` messages (L19-22)
- Triggers HTTP POST request when session ID is obtained (L25-43)

**POST Request Logic (L25-43)**
- Sends JSON-RPC 2.0 `tools/list` method call
- Uses extracted session ID in `X-Session-ID` header
- Handles response/error logging

**Error Handling (L51-53)**
- Basic SSE error event logging

**Process Management (L56-57)**
- Keeps Node.js process alive for continuous testing

## Dependencies
- `eventsource` package for EventSource polyfill in Node.js
- Built-in `fetch` API for HTTP requests

## Communication Protocol
- Expects JSON-RPC 2.0 messages over SSE
- Uses session-based authentication via custom header
- Bidirectional: SSE for server-to-client, HTTP POST for client-to-server

## Test Scenario
1. Establish SSE connection
2. Wait for connection confirmation with session ID
3. Send authenticated JSON-RPC request using session
4. Monitor both SSE events and HTTP responses