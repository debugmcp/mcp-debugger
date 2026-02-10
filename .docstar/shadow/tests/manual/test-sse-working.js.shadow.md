# tests/manual/test-sse-working.js
@source-hash: 6639615c06932383
@generated: 2026-02-10T00:41:55Z

## Purpose
Manual test script for validating Server-Sent Events (SSE) connection with session-based communication. Tests the complete SSE handshake flow including session ID extraction and subsequent authenticated API calls.

## Key Components

### SSE Parser (L10-26)
- `parseSSEData(chunk)`: Parses raw SSE data chunks into structured messages
- Extracts `data: ` prefixed lines and attempts JSON parsing
- Returns array of parsed message objects
- Silently ignores non-JSON data lines

### Main SSE Connection (L29-63)
- Establishes HTTP GET request to `http://localhost:3001/sse`
- Sets proper SSE headers (`Accept: text/event-stream`, `Cache-Control: no-cache`)
- Monitors for `connection/established` messages containing session ID
- Triggers follow-up POST test after 1 second delay when session ID received

### POST Request Testing (L70-122)
- `testPostRequest(sessionId)`: Tests JSON-RPC API call with session authentication
- Sends `tools/list` request with `X-Session-ID` header
- Handles both JSON and non-JSON responses
- Keeps connection alive for 2 seconds to observe any SSE responses

## Dependencies
- Node.js `http` module for HTTP client operations
- Node.js `https` module (imported but unused)

## Execution Flow
1. Establish SSE connection to localhost:3001
2. Parse incoming SSE data for session establishment
3. Extract session ID from `connection/established` message
4. Wait 1 second, then send authenticated POST request
5. Display all responses and keep script running for manual inspection

## Test Configuration
- Target server: `localhost:3001/sse`
- Session timeout: 1 second before POST request
- Response observation window: 2 seconds after POST completion
- Manual termination required (Ctrl+C)

## Error Handling
- Connection errors logged to console
- SSE parsing errors silently ignored
- JSON parsing failures handled gracefully
- POST request errors logged with context