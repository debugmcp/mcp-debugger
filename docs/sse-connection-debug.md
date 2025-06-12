# SSE Connection Debugging Guide

## Overview

The SSE (Server-Sent Events) transport for MCP requires a two-part connection:
1. **GET /sse** - Establishes the SSE connection and receives a session ID
2. **POST /sse** - Sends requests with the session ID in the `X-Session-ID` header

## Current Issue

When Cline tries to connect to the SSE server, it gets:
```
Error POSTing to endpoint (HTTP 400): {"jsonrpc":"2.0","error":{"code":-32600,"message":"Invalid session ID"},"id":null}
```

## How SSE Connection Works

1. **Initial Connection** (GET /sse)
   - Client connects to the SSE endpoint
   - Server creates a new session and sends `connection/established` message
   - Message format: `data: {"jsonrpc":"2.0","method":"connection/established","params":{"sessionId":"<uuid>"}}`

2. **Subsequent Requests** (POST /sse)
   - Client sends JSON-RPC requests with `X-Session-ID` header
   - Server processes the request and sends response via SSE stream

## Testing the Connection

### Step 1: Start the SSE Server
```cmd
.\start-sse-server.cmd
```

### Step 2: Verify Server Health
```powershell
Invoke-RestMethod -Uri http://localhost:3001/health
```

### Step 3: Test SSE Connection Manually

Using PowerShell to establish SSE connection:
```powershell
# This will establish connection and show the session ID
$response = Invoke-WebRequest -Uri http://localhost:3001/sse -Headers @{"Accept"="text/event-stream"} -Method GET -TimeoutSec 5
$response.Content
```

### Step 4: Test POST with Session ID
```powershell
$sessionId = "YOUR-SESSION-ID-HERE"
$body = @{
    jsonrpc = "2.0"
    method = "tools/list"
    id = 1
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3001/sse -Method POST -Headers @{"Content-Type"="application/json"; "X-Session-ID"=$sessionId} -Body $body
```

## Cline Configuration

The current configuration in `cline_mcp_settings.json`:
```json
"mcp-debugger-sse": {
  "transportType": "sse",
  "url": "http://localhost:3001/sse"
}
```

## Potential Issues and Solutions

### 1. Session ID Not Being Extracted
Cline might not be properly parsing the `connection/established` message to extract the session ID.

### 2. Timing Issue
The POST request might be sent before the session is fully established.

### 3. Protocol Mismatch
The MCP SDK's SSE transport implementation might expect a different message format.

## Next Steps

1. **Enable Debug Logging in Cline**
   - Check if Cline has debug logging options to see the exact requests being made

2. **Monitor Network Traffic**
   - Use browser developer tools or a network monitor to see the exact HTTP requests

3. **Test with MCP CLI**
   - Use the official MCP CLI tools to test the SSE connection

4. **Check SDK Compatibility**
   - Ensure the server's SSE implementation matches the expected protocol in the MCP SDK

## Server Logs Location

Debug logs are saved to: `logs/debug-mcp-server.log`

Session-specific logs are saved to: `%LOCALAPPDATA%\Temp\debug-mcp-server\sessions\` (Windows) or `/tmp/debug-mcp-server/sessions/` (Unix)
