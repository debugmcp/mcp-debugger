# MCP Debug Server - Debugging Guide

This guide covers how to debug the MCP Debug Server itself during development. Yes, we're debugging the debugger! 🐛

## Overview

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

**Debug Steps**:

```typescript
// Add to src/index.ts
console.log('[DEBUG] Starting server with args:', process.argv);
console.log('[DEBUG] Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  DEBUG: process.env.DEBUG,
  PATH: process.env.PATH
});

// Check transport initialization
try {
  await server.start();
  console.log('[DEBUG] Server started successfully');
} catch (error) {
  console.error('[DEBUG] Server start failed:', error);
  console.error('[DEBUG] Stack:', error.stack);
}
```

### 2. Proxy Process Issues

**Symptoms**: Proxy doesn't spawn or exits immediately

**Debug Steps**:

```typescript
// In ProxyManager.start()
console.log('[DEBUG] Spawning proxy with:', {
  script: proxyScriptPath,
  sessionId: config.sessionId,
  env: Object.keys(env)
});

// Monitor process events
this.proxyProcess.on('spawn', () => {
  console.log('[DEBUG] Proxy spawned, PID:', this.proxyProcess.pid);
});

this.proxyProcess.on('error', (err) => {
  console.error('[DEBUG] Proxy error:', err);
});

this.proxyProcess.stderr?.on('data', (data) => {
  console.error('[DEBUG] Proxy STDERR:', data.toString());
});
```

### 3. IPC Communication Problems

**Symptoms**: Messages not received, commands timeout

**Debug Steps**:

```typescript
// In proxy message handler
private handleProxyMessage(rawMessage: unknown): void {
  console.log('[DEBUG] Raw message:', JSON.stringify(rawMessage, null, 2));
  
  if (!isValidProxyMessage(rawMessage)) {
    console.warn('[DEBUG] Invalid message format:', {
      type: typeof rawMessage,
      keys: rawMessage ? Object.keys(rawMessage) : null
    });
    return;
  }
  
  const message = rawMessage as ProxyMessage;
  console.log('[DEBUG] Parsed message type:', message.type);
}

// In proxy process
process.on('message', (msg) => {
  console.log('[DEBUG Proxy] Received from parent:', msg);
});

if (process.send) {
  const testMsg = { type: 'test', data: 'hello' };
  console.log('[DEBUG Proxy] Sending test message:', testMsg);
  process.send(testMsg);
}
```

### 4. DAP Protocol Issues

**Symptoms**: Debugpy not responding, breakpoints not working

**Debug Steps**:

```typescript
// Log all DAP traffic
this.dapClient.on('send', (message) => {
  console.log('[DAP →]', JSON.stringify(message, null, 2));
});

this.dapClient.on('receive', (message) => {
  console.log('[DAP ←]', JSON.stringify(message, null, 2));
});

// Track request lifecycle
console.log('[DEBUG] Sending DAP request:', {
  command,
  requestId,
  args: JSON.stringify(args)
});

// In response handler
console.log('[DEBUG] DAP response received:', {
  requestId: message.requestId,
  success: message.success,
  command: pending?.command,
  elapsed: Date.now() - requestStartTime
});
```

### 5. State Management Issues

**Symptoms**: Incorrect state transitions, stuck states

**Debug Steps**:

```typescript
// Add state transition logging
private _updateSessionState(session: ManagedSession, newState: SessionState): void {
  const oldState = session.state;
  console.log('[DEBUG] State transition:', {
    sessionId: session.id,
    oldState,
    newState,
    stack: new Error().stack?.split('\n')[2] // Caller
  });
  
  if (!this.isValidTransition(oldState, newState)) {
    console.error('[DEBUG] Invalid state transition!');
  }
  
  this.sessionStore.updateState(session.id, newState);
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
  const stream = fs.createWriteStream(fileName);
  v8.writeHeapSnapshot(stream);
  console.log(`[DEBUG] Heap snapshot written to ${fileName}`);
}

// Usage
takeHeapSnapshot('before-session-create');
// ... create sessions
takeHeapSnapshot('after-session-create');
```

### 5. Event Tracing

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
  // Add progress logging
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
      "args": ["path/to/dist/index.js"],
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

Add diagnostic tools to the server:

```typescript
// Add diagnostic tool
server.addTool({
  name: 'debug_diagnostics',
  description: 'Get diagnostic information',
  inputSchema: { type: 'object', properties: {} },
  handler: async () => {
    return {
      sessions: sessionManager.getAllSessions(),
      processInfo: {
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        versions: process.versions
      },
      activeProxies: getActiveProxyCount()
    };
  }
});
```

### 3. Health Checks

```typescript
// Add health endpoint for SSE mode
if (transport === 'sse') {
  const healthServer = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        sessions: sessionManager.getAllSessions().length,
        uptime: process.uptime()
      }));
    }
  });
  healthServer.listen(port + 1);
}
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

2. **Add Temporary Logging**
   ```typescript
   const DEBUG_THIS = true;
   if (DEBUG_THIS) console.log('[TEMP]', { data });
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

Remember: When debugging gets tough, add more logging! 📝
