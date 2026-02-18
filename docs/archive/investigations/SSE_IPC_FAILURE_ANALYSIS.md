# SSE Mode IPC Failure Analysis and Fix Attempts

## Problem Summary
In SSE mode, JavaScript debugging fails when trying to get stack traces after hitting a breakpoint. The `get_stack_trace` command times out with empty results.

## Root Cause Analysis

### 1. Initial Issue (Fixed)
- **Problem**: Each SSE connection was creating a new DebugMcpServer instance
- **Impact**: Sessions created on one connection were invisible to commands from another
- **Fix Applied**: Maintain a single shared DebugMcpServer instance across all SSE connections
- **Result**: ✅ Sessions now persist across connections

### 2. IPC Communication Failure (Not Fixed)
- **Problem**: IPC communication between ProxyManager and proxy worker breaks after `stopped` event
- **Symptoms**:
  - `stackTrace` command sent by ProxyManager
  - Command never appears in proxy worker logs
  - Times out after 35 seconds
  - Last successful IPC message is #6 (launch command)
  - No further IPC messages are received by proxy worker

## Fix Attempts

### Attempt 1: Remove `detached` flag (FAILED)
- **Theory**: Process group signaling might affect IPC when debugged process pauses
- **Change**: Set `detached: false` in process spawning options
- **Result**: ❌ No improvement - IPC still fails after breakpoint

### Investigation Findings

1. **IPC Channel Status**:
   - ProxyManager successfully sends commands (no errors)
   - Proxy worker's IPC handler is set up correctly
   - Messages work fine until the `stopped` event
   - After `stopped` event, no IPC messages reach the proxy worker

2. **Process Configuration**:
   - Proxy spawned with `stdio: ['pipe', 'pipe', 'pipe', 'ipc']`
   - Working directory correctly set to project root
   - Environment variables properly configured
   - IPC channel confirmed available on startup

3. **Message Flow Timeline**:
   ```
   17:21:30 - IPC message #1: init (received)
   17:21:30 - IPC message #2: initialize (received)
   17:21:30 - IPC message #3: setExceptionBreakpoints (received)
   17:21:30 - IPC message #4: setBreakpoints (received)
   17:21:30 - IPC message #5: configurationDone (received)
   17:21:30 - IPC message #6: launch (received)
   17:21:31 - Breakpoint hit, stopped event emitted
   17:21:51 - stackTrace command sent (NOT received by proxy)
   17:22:26 - stackTrace times out
   ```

## Deeper Analysis

The issue appears to be that the Node.js IPC channel becomes unresponsive after the debugged JavaScript process pauses at a breakpoint. This is likely due to:

1. **Event Loop Interaction**: The proxy worker and debugged process might share some event loop context that gets blocked
2. **IPC Buffer State**: The IPC channel might have unread data that's blocking new messages
3. **Node.js Internal Behavior**: Node.js IPC might have undocumented behavior when child processes debug other processes

## Key Differences: SSE vs STDIO

### SSE Mode
- Server runs as HTTP server with SSE connections
- ProxyManager spawns proxy worker as child process
- Proxy worker spawns debug adapter
- Multiple layers of IPC communication
- **Issue occurs here**

### STDIO Mode  
- Direct process communication via stdin/stdout
- Simpler process hierarchy
- No HTTP/SSE layer
- **Works correctly**

## Potential Root Causes

1. **IPC Channel Blocking**: When the debugged process pauses, it might cause the IPC channel to block if there's output that's not being consumed
2. **Shared Event Loop**: The proxy worker might be affected by the paused state of the debugged process
3. **Windows-Specific Issue**: This might be a Windows-specific Node.js IPC behavior

## Recommended Solutions

### Option 1: Replace IPC with TCP Sockets
- Most reliable solution
- Would require significant refactoring
- Avoids Node.js IPC quirks entirely

### Option 2: Use Worker Threads
- Keep proxy logic in same process using Worker Threads
- Avoids IPC entirely for proxy communication
- Simpler architecture

### Option 3: Implement IPC Recovery
- Detect IPC failure and restart proxy
- Buffer commands during disruption
- Less ideal but might work as workaround

### Option 4: Debug Node.js IPC
- Add extensive IPC debugging
- Try to understand why channel stops working
- Might reveal a simple fix

## Test Results Summary

| Mode | Session Creation | Breakpoints | Debugging | Stack Trace |
|------|-----------------|-------------|-----------|-------------|
| STDIO | ✅ | ✅ | ✅ | ✅ |
| SSE (Original) | ❌ Session lost | ✅ | ✅ | ❌ Timeout |
| SSE (Fix #1) | ✅ | ✅ | ✅ | ❌ Timeout |
| SSE (Fix #1 + detached:false) | ✅ | ✅ | ✅ | ❌ Timeout |

## Conclusion

The IPC failure in SSE mode appears to be a fundamental issue with how Node.js handles IPC channels when child processes are debugging other processes. The channel becomes unresponsive after the debugged process pauses, preventing any further communication.

This is not a simple configuration issue but rather a deeper architectural problem that likely requires either:
1. Replacing IPC with a different communication mechanism (TCP sockets)
2. Restructuring the proxy architecture to avoid IPC
3. Finding a workaround for the Node.js IPC behavior

The issue does not occur in STDIO mode because it uses a different process communication approach that doesn't rely on Node.js IPC channels in the same way.
