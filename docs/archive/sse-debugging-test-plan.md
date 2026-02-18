# SSE JavaScript Debugging Test Plan

## Diagnostic Logging Added

We've added comprehensive logging to capture:
1. **Environment variables** passed to the proxy worker (in `process-launcher-impl.ts`)
2. **Critical environment variables** when spawning the adapter, including:
   - NODE_OPTIONS
   - NODE_DEBUG
   - NODE_ENV
   - DEBUG
   - VSCODE_INSPECTOR_OPTIONS
3. **Full spawn command** with arguments and --inspect flag detection

## Test Procedure

### 1. Clean Test Environment
```batch
# Clear any existing logs
del logs\debug-mcp-server-sse.log
del logs\proxy-*.log
```

### 2. Run SSE Server
```batch
# From any directory (not project root)
scripts\start-sse-server.cmd
```

### 3. Trigger JavaScript Debugging
Use your MCP client to start debugging `examples/javascript/simple_test.js`

### 4. Check Diagnostic Output

Look for these key log entries:

#### In Console Output:
```
[ProxyProcessLauncher] Environment check for proxy worker: {
  NODE_OPTIONS: ...,
  NODE_DEBUG: ...,
  NODE_ENV: ...,
  DEBUG: ...,
  hasInspectInNodeOptions: ...,
  launchingFrom: ...,
  targetCwd: ...,
  sessionId: ...
}
```

#### In logs/proxy-*.log:
```
[AdapterManager] Spawn configuration: {
  command: ...,
  args: [...],
  cwd: ...,
  envVars: ...,
  criticalEnvVars: {
    NODE_OPTIONS: ...,
    NODE_DEBUG: ...,
    NODE_ENV: ...,
    DEBUG: ...,
    VSCODE_INSPECTOR_OPTIONS: ...,
    hasInspectVars: ...
  }
}

[AdapterManager] Full command to execute: {
  fullCommand: ...,
  execArgv: [...],
  hasInspectFlag: ...
}
```

## Things to Check

1. **NODE_OPTIONS** - Is it set? Does it contain --inspect already?
2. **Command Arguments** - Does js-debug include --inspect in the args?
3. **Environment Propagation** - Are any debug-related vars being inherited?
4. **Working Directory** - Confirm cwd is set correctly

## Tests to Run

### Test 1: Normal SSE Mode
Run as described above, capture logs

### Test 2: With Administrator Privileges
```batch
# Right-click Command Prompt, Run as Administrator
scripts\start-sse-server.cmd
```

### Test 3: With Windows Defender Disabled
1. Temporarily disable Windows Defender Real-time Protection
2. Run the SSE server
3. Test debugging
4. Re-enable Windows Defender

### Test 4: Clean NODE_OPTIONS
```batch
# Clear NODE_OPTIONS before running
set NODE_OPTIONS=
scripts\start-sse-server.cmd
```

### Test 5: Direct Execution (Skip Script)
```batch
# From project root directly
node dist\index.js sse --port 3001 --log-level debug --log-file logs\debug-mcp-server-sse.log
```

## Expected Findings

Based on the research, we're looking for:
1. **NODE_OPTIONS conflict** - Parent has --inspect that conflicts with child
2. **Silent security blocking** - No error but port can't bind
3. **Environment inheritance issue** - Something in SSE environment blocks debugging

## Log Analysis

After running tests, look for:
- Differences in environment variables between SSE and STDIO
- Whether --inspect flag is present in the spawn command
- Any NODE_OPTIONS that might cause port conflicts
- Signs that the debugger tried to start but failed
