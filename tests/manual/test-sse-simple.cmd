@echo off
echo Testing SSE connection...
echo.
echo Step 1: Connecting to SSE endpoint to get session ID
echo.

REM Use curl to connect to SSE endpoint
curl -N -H "Accept: text/event-stream" http://localhost:3001/sse

echo.
echo.
echo Note: Copy the sessionId from the connection/established message above
echo Then test POST with: curl -X POST -H "Content-Type: application/json" -H "X-Session-ID: <sessionId>" -d "{\"jsonrpc\":\"2.0\",\"method\":\"tools/list\",\"id\":1}" http://localhost:3001/sse
