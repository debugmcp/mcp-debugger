# SSE Session Persistence Fix

## Problem

In SSE mode, debug sessions were being terminated whenever the SSE connection dropped (even momentarily). This happened because:

1. **Each SSE connection created a new `DebugMcpServer` instance**
2. When an SSE connection closed, it called `debugMcpServer.stop()` 
3. This stopped the entire server and closed ALL debug sessions
4. When the client reconnected, a brand new server was created with no knowledge of previous sessions

## Root Cause

The fundamental issue was a design flaw in `src/cli/sse-command.ts`:
- SSE mode created a new server instance per connection
- STDIO mode used a single server instance for its lifetime
- This asymmetry caused debug sessions to be tied to transport connection lifecycle in SSE mode

## Solution

We modified the SSE implementation to use a **single shared server instance** that persists across connections:

### Key Changes in `src/cli/sse-command.ts`:

1. **Created a shared server instance at app initialization:**
```typescript
// Create a single shared Debug MCP Server instance for all connections
const sharedDebugServer = serverFactory({
  logLevel: options.logLevel,
  logFile: options.logFile,
});
```

2. **Modified connection handler to use the shared server:**
```typescript
// Connect the shared server to the transport (not creating a new server)
await sharedDebugServer.server.connect(transport);
```

3. **Updated close handler to only clean up transport:**
```typescript
// Clean up only the transport, NOT the shared server
// The shared server persists across connections
logger.info(`SSE transport cleaned up for session ${sessionId}. Debug sessions remain active.`);
```

4. **Fixed graceful shutdown to properly stop the shared server:**
```typescript
// Stop the shared debug server
if (sharedDebugServer) {
  logger.info('Stopping shared Debug MCP Server...');
  sharedDebugServer.stop().catch((error) => {
    logger.error('Error stopping shared Debug MCP Server:', error);
  });
}
```

## Benefits

1. **Session Persistence**: Debug sessions now persist across SSE connection drops/reconnects
2. **Consistency**: SSE and STDIO modes now have the same server lifecycle behavior
3. **Resilience**: Network interruptions, client refreshes, or temporary disconnections don't affect active debug sessions
4. **Multi-client Support**: Multiple SSE clients can potentially connect to the same debug sessions

## Testing

To verify the fix:
1. Start SSE server: `scripts/start-sse-server.cmd`
2. Create a debug session and start debugging
3. Disconnect/reconnect the SSE client
4. Verify the debug session is still active and accessible

## Additional Notes

- The NODE_OPTIONS investigation showed it wasn't causing the issue (only contained memory settings)
- The JavaScript debugging was working correctly; the issue was purely at the session management level
- This fix maintains backward compatibility while fixing the core architectural issue
