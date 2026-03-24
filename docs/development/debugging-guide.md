# MCP Debug Server - Debugging Guide

This guide covers how to debug the MCP Debug Server itself during development. Yes, we're debugging the debugger! 🐛

## Overview

> **Warning**: `console.log`, `console.error`, and all other `console` methods are silenced at process startup (in both STDIO and SSE modes) to protect stdio/IPC transports from being corrupted by unexpected output. Any `console.*` calls you add to server or proxy code will produce no output. Use `this.logger.debug(...)` (or another Winston logger method) for in-process logging, or write directly to a file (e.g., `fs.appendFileSync('/tmp/debug.log', ...)`) for low-level startup diagnostics.

Debugging a debug server presents unique challenges:
- Multiple processes (server, proxy, debug adapter)
- Cross-process communication via IPC
- Async operations and event-driven architecture
- Protocol-level interactions (MCP, DAP)

## Development Tools

### 1. VS Code Debugger

The project includes launch configurations for debugging:

```json
// .vscode/launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Server (STDIO)",
  "skipFiles": ["<node_internals>/**"],
  "program": "${workspaceFolder}/dist/index.js",
  "outFiles": ["${workspaceFolder}/dist/**/*.js"],
  "preLaunchTask": "npm: build",
  "env": {
    "DEBUG": "*",
    "LOG_LEVEL": "debug"
  }
}
```

### 2. Chrome DevTools

For advanced debugging:

```bash
# Start with inspector
node --inspect dist/index.js

# Or break on first line
node --inspect-brk dist/index.js
```

Then open Chrome and navigate to `chrome://inspect`.

### 3. Debug Logging

Enable comprehensive logging:

```bash
# All debug output
DEBUG=* node dist/index.js

# Specific modules
DEBUG=mcp:*,proxy:* node dist/index.js

# With log file
LOG_LEVEL=debug LOG_FILE=debug.log node dist/index.js
```

## Common Debugging Scenarios

### 1. Server Won't Start

**Symptoms**: Server exits immediately or hangs

**Important**: The entrypoint (`src/index.ts`) silences nearly all `console` methods at module load to protect stdio/IPC transports. Adding `console.log` to the entrypoint will produce no output. Use the Winston logger or write to a file instead.

**Debug Steps**:

```typescript
// In src/index.ts — use the logger, not console (console is silenced)
import fs from 'fs';
// Write diagnostics to a file since console output is suppressed
fs.appendFileSync('/tmp/mcp-debug-startup.log',
  `[DEBUG] Starting server with args: ${process.argv.join(' ')}\n`);

// Transport startup is managed in src/cli/stdio-command.ts or src/cli/sse-command.ts,
// not in DebugMcpServer.start() (which only logs startup/build info).
// To debug transport binding, add logger calls to the CLI command handlers.
```

### 2. Proxy Process Issues

**Symptoms**: Proxy doesn't spawn or exits immediately

**Debug Steps**:

```typescript
// In ProxyManager.start() — use this.logger, not console (console is silenced)
this.logger.debug('[DEBUG] Spawning proxy with:', {
  script: proxyScriptPath,
  sessionId: config.sessionId,
  env: Object.keys(env)
});

// Monitor process events
this.proxyProcess.on('spawn', () => {
  this.logger.debug('[DEBUG] Proxy spawned, PID:', this.proxyProcess.pid);
});

this.proxyProcess.on('error', (err) => {
  this.logger.error('[DEBUG] Proxy error:', err);
});

this.proxyProcess.stderr?.on('data', (data) => {
  this.logger.error('[DEBUG] Proxy STDERR:', data.toString());
});
```

### 3. IPC Communication Problems

**Symptoms**: Messages not received, commands timeout

**Debug Steps**:

```typescript
// In proxy message handler — use this.logger, not console (console is silenced)
private handleProxyMessage(rawMessage: unknown): void {
  this.logger.debug('[DEBUG] Raw message:', JSON.stringify(rawMessage, null, 2));

  if (!isValidProxyMessage(rawMessage)) {
    this.logger.warn('[DEBUG] Invalid message format:', {
      type: typeof rawMessage,
      keys: rawMessage ? Object.keys(rawMessage) : null
    });
    return;
  }

  const message = rawMessage as ProxyMessage;
  this.logger.debug('[DEBUG] Parsed message type:', message.type);
}

// In proxy process — use the proxy's logger instance
this.logger.debug('[DEBUG Proxy] Received from parent:', msg);

this.logger.debug('[DEBUG Proxy] Sending test message:', testMsg);
```

### 4. DAP Protocol Issues

**Symptoms**: Debugpy not responding, breakpoints not working

**Debug Steps**:

```typescript
// Log all DAP traffic — use this.logger, not console (console is silenced)
this.dapClient.on('send', (message) => {
  this.logger.debug('[DAP send]', JSON.stringify(message, null, 2));
});

this.dapClient.on('receive', (message) => {
  this.logger.debug('[DAP recv]', JSON.stringify(message, null, 2));
});

// Track request lifecycle
// Note: There are two layers of request correlation:
// - Raw DAP responses (in MinimalDapClient): correlated by `request_seq`
// - Proxy-to-parent `dapResponse` envelopes (in ProxyManager): correlated by `requestId`
this.logger.debug('[DEBUG] Sending DAP request:', {
  command,
  request_seq,  // For raw DAP responses
  requestId,    // For proxy dapResponse envelopes
  args: JSON.stringify(args)
});
```

### 5. State Management Issues

**Symptoms**: Incorrect state transitions, stuck states

**Debug Steps**:

```typescript
// Actual implementation in src/session/session-manager-core.ts
protected _updateSessionState(session: ManagedSession, newState: SessionState): void {
  if (session.state === newState) return;
  this.logger.info(`[SM _updateSessionState ${session.id}] State change: ${session.state} -> ${newState}`);

  // Update legacy state
  this.sessionStore.updateState(session.id, newState);

  // Update new state model based on legacy state
  const { lifecycle, execution } = mapLegacyState(newState);
  this.sessionStore.update(session.id, {
    sessionLifecycle: lifecycle,
    executionState: execution
  });
}
```

## Advanced Debugging Techniques

### 1. Process Tree Visualization

```bash
# On Unix/macOS
ps aux | grep -E "node|python|debugpy" | grep -v grep

# With tree view
pstree -p $(pgrep -f "mcp-debug-server")

# On Windows
wmic process where "name like '%node%' or name like '%python%'" get processid,parentprocessid,commandline
```

### 2. Network Port Monitoring

```bash
# Check if debugpy is listening
netstat -an | grep 5678

# On macOS
lsof -i :5678

# Monitor connection attempts
tcpdump -i lo0 port 5678
```

### 3. File System Monitoring

```bash
# Watch log directory
watch -n 1 'ls -la logs/'

# Tail all logs
tail -f logs/*.log

# Monitor file descriptor usage
lsof -p $(pgrep -f "proxy-bootstrap")
```

### 4. Memory Profiling

```typescript
// Add heap snapshots
import v8 from 'v8';
import fs from 'fs';

function takeHeapSnapshot(label: string) {
  const fileName = `heap-${label}-${Date.now()}.heapsnapshot`;
  const writtenPath = v8.writeHeapSnapshot(fileName);
  console.log(`[DEBUG] Heap snapshot written to ${writtenPath}`);
}

// Usage
takeHeapSnapshot('before-session-create');
// ... create sessions
takeHeapSnapshot('after-session-create');
```

### 5. Event Tracing

> **Note:** In stdio/IPC transport mode, `console.log` is silenced at startup to protect the JSON-RPC protocol. Event tracing output will not appear unless you use the SSE transport or redirect logging to a file.

```typescript
// Trace all events
const originalEmit = EventEmitter.prototype.emit;
EventEmitter.prototype.emit = function(event: string, ...args: any[]) {
  console.log('[EVENT]', {
    emitter: this.constructor.name,
    event,
    args: args.length,
    stack: new Error().stack?.split('\n')[2]
  });
  return originalEmit.apply(this, [event, ...args]);
};
```

## Debugging Test Failures

### 1. Verbose Test Output

```bash
# Run with full output
npm test -- --reporter=verbose

# Debug specific test
DEBUG=* npm test -- tests/unit/proxy/proxy-manager.test.ts

# With Node debugging
node --inspect-brk node_modules/.bin/vitest run tests/unit/session/session-manager.test.ts
```

### 2. Test Timeout Debugging

```typescript
it('should complete operation', async () => {
  // In test files, console methods are available (silencing only applies to
  // the server/proxy processes, not the vitest runner).
  console.log('[TEST] Starting operation');

  const checkpoints = [];
  const addCheckpoint = (name: string) => {
    checkpoints.push({ name, time: Date.now() });
    console.log(`[TEST] Checkpoint: ${name}`);
  };

  addCheckpoint('start');
  await operation1();
  addCheckpoint('after-op1');
  await operation2();
  addCheckpoint('after-op2');

  // If timeout, log checkpoints
  process.on('uncaughtException', () => {
    console.log('[TEST] Checkpoints:', checkpoints);
  });
});
```

### 3. Mock Inspection

```typescript
// Log all mock calls
afterEach(() => {
  console.log('[TEST] Mock calls:', {
    logger: mockLogger.info.mock.calls,
    fileSystem: mockFileSystem.readFile.mock.calls,
    network: mockNetworkManager.findFreePort.mock.calls
  });
});
```

## Production Debugging

### 1. Enable Debug Mode

```json
// In MCP settings
{
  "mcpServers": {
    "debug-mcp-server": {
      "command": "node",
      "args": ["path/to/dist/index.js", "stdio"],
      "env": {
        "DEBUG": "mcp:*,session:*,proxy:*",
        "LOG_LEVEL": "debug",
        "LOG_FILE": "/tmp/mcp-debug.log"
      }
    }
  }
}
```

### 2. Diagnostic Commands

To add diagnostic tools, extend the `registerTools()` method in `src/server.ts`. Tools are registered via `ListToolsRequestSchema` and `CallToolRequestSchema` request handlers, not via a standalone `addTool()` API:

```typescript
// Inside registerTools() in src/server.ts, add to the tools array in ListToolsRequestSchema handler:
{ name: 'debug_diagnostics', description: 'Get diagnostic information',
  inputSchema: { type: 'object', properties: {} } },

// And add a case in the CallToolRequestSchema handler's switch:
case 'debug_diagnostics':
  return {
    content: [{ type: 'text', text: JSON.stringify({
      pid: process.pid,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      versions: process.versions
    }, null, 2) }]
  };
```

### 3. Health Checks

The SSE command handler (`src/cli/sse-command.ts`) already exposes a `GET /health` endpoint on the same port as the SSE server. No separate server is needed:

```bash
# Query the built-in health endpoint (default port 3001)
curl http://localhost:3001/health
# Returns: { "status": "ok", "mode": "sse", "connections": N, "sessions": [...] }
```

## Debugging Checklists

### Server Startup Issues
- [ ] Check Node.js version (`node --version`)
- [ ] Verify all dependencies installed (`npm ls`)
- [ ] Check for port conflicts
- [ ] Verify file permissions on log directory
- [ ] Check environment variables
- [ ] Look for TypeScript compilation errors

### Proxy Communication Issues
- [ ] Verify proxy script exists and is executable
- [ ] Check IPC channel is established
- [ ] Monitor process spawn events
- [ ] Check for stderr output
- [ ] Verify message serialization format
- [ ] Look for uncaught exceptions in proxy

### Python Debugging Issues
- [ ] Verify Python path is correct
- [ ] Check debugpy is installed (`pip show debugpy`)
- [ ] Verify script path is absolute
- [ ] Check for Python syntax errors
- [ ] Monitor debugpy adapter output
- [ ] Verify DAP message format

### Memory/Performance Issues
- [ ] Check for event listener leaks
- [ ] Monitor session cleanup
- [ ] Verify process termination
- [ ] Check for circular references
- [ ] Monitor file descriptor usage
- [ ] Profile CPU usage during operations

## Tips and Tricks

1. **Use Conditional Breakpoints**
   ```typescript
   // Break only for specific session
   if (sessionId === 'problematic-session-id') {
     debugger; // VS Code will stop here
   }
   ```

2. **Add Temporary Logging** (remember: all `console` methods are silenced at startup)
   ```typescript
   const DEBUG_THIS = true;
   if (DEBUG_THIS) this.logger.debug('[TEMP]', { data });
   ```

3. **Binary Search for Issues**
   - Comment out half the code
   - See if issue persists
   - Narrow down to problematic section

4. **Use Git Bisect**
   ```bash
   git bisect start
   git bisect bad HEAD
   git bisect good v0.8.0
   # Git will help find the breaking commit
   ```

5. **Create Minimal Reproduction**
   - Isolate the problem
   - Remove unnecessary code
   - Create standalone test case

## Summary

Debugging the MCP Debug Server requires:
- Understanding the multi-process architecture
- Monitoring IPC communication
- Tracking async operations
- Using appropriate debugging tools
- Following systematic debugging approach

Remember: When debugging gets tough, add more logging via the Winston logger (not `console`, which is silenced at startup).
