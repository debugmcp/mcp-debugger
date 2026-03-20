# JavaScript Debugging Guide

## Overview

The JavaScript adapter provides full debugging support for Node.js applications using Microsoft's proven `js-debug` (pwa-node) debugger from VSCode. This includes support for:

- Node.js applications
- ES modules and CommonJS
- Child process debugging
- Multi-session debugging architecture

## Architecture

The JavaScript adapter uses a sophisticated multi-session architecture:

```
┌─────────────────┐
│   MCP Client    │
└────────┬────────┘
         │
┌────────▼────────┐
│ Session Manager │
└────────┬────────┘
         │
┌────────▼────────┐
│  ProxyManager   │──► Parent Session
└────────┬────────┘    (Initialization)
         │
┌────────▼────────┐
│ChildSessionMgr │──► Child Session  
└─────────────────┘    (Actual Debug Target)
```

### Key Components

1. **Parent Session**: Handles initialization and adapter setup
2. **Child Session**: Created via `startDebugging` request for the actual Node.js process
3. **Session Adoption**: Uses `__pendingTargetId` mechanism to adopt child sessions
4. **Command Routing**: Routes commands between parent and child sessions as appropriate

## Quick Start

### Basic JavaScript Debugging

```javascript
// example.js
function calculateSum(a, b) {
  console.log(`Calculating sum of ${a} and ${b}`);
  const result = a + b;  // Set breakpoint here
  return result;
}

const sum = calculateSum(5, 3);
console.log(`Result: ${sum}`);
```

### Debug Session Example

```json
// 1. Create session
{
  "tool": "create_debug_session",
  "params": {
    "language": "javascript",
    "name": "JS Debug Example"
  }
}

// 2. Set breakpoint
{
  "tool": "set_breakpoint",
  "params": {
    "sessionId": "session-id",
    "file": "example.js",
    "line": 3
  }
}

// 3. Start debugging
{
  "tool": "start_debugging",
  "params": {
    "sessionId": "session-id",
    "scriptPath": "example.js"
  }
}
```

## Configuration

The JavaScript adapter automatically configures:

- **Runtime**: Uses system Node.js or specified executable
- **Console**: Captures stdout/stderr
- **Smart Stepping**: Skips node internals

### Custom Configuration

You can provide custom DAP launch arguments:

```json
{
  "tool": "start_debugging",
  "params": {
    "sessionId": "session-id",
    "scriptPath": "app.js",
    "dapLaunchArgs": {
      "env": {
        "NODE_ENV": "development"
      },
      "args": ["--port", "3000"],
      "cwd": "/path/to/project"
    }
  }
}
```


## Advanced Features

### Child Process Debugging

The adapter can attach to child processes, but `autoAttachChildProcesses` defaults to `false`. To enable automatic child process attachment, pass it explicitly in `dapLaunchArgs`:

```javascript
// parent.js
const { spawn } = require('child_process');

const child = spawn('node', ['child.js']);
// Debugger will only attach to child.js if autoAttachChildProcesses is set to true
```

### Conditional Breakpoints

```json
{
  "tool": "set_breakpoint",
  "params": {
    "sessionId": "session-id",
    "file": "app.js",
    "line": 10,
    "condition": "count > 5"
  }
}
```

### Log Points

```json
{
  "tool": "set_breakpoint",
  "params": {
    "sessionId": "session-id",
    "file": "app.js",
    "line": 15,
    "logMessage": "Value is {value}"
  }
}
```

## Troubleshooting

### Common Issues

1. **Breakpoints Not Hitting**
   - Ensure file paths are correct (use absolute paths when possible)
   - Verify the code is actually executing

2. **Session Not Starting**
   - Check Node.js is in PATH or specify `executablePath`
   - Ensure the script file exists
   - Check for syntax errors in the JavaScript file

3. **Variables Not Showing**
   - Wait for the debugger to pause at a breakpoint
   - Use correct frame ID from stack trace
   - Check scope reference from `get_scopes`

### Debug Logging

Enable detailed logging to troubleshoot issues:

```json
{
  "tool": "start_debugging",
  "params": {
    "sessionId": "session-id",
    "scriptPath": "app.js",
    "dapLaunchArgs": {
      "trace": true
    }
  }
}
```

Note: `trace` is a DAP launch argument passed when starting the debug session, not a session-creation option.

## Known Limitations

### TypeScript Source Mapping

TypeScript debugging is functional. The adapter supports TypeScript through runtime transpilers (tsx, ts-node) which are auto-detected, and through compiled JavaScript files with source maps.

**Current Workaround Options:**

1. **Debug the compiled JavaScript directly** - Set breakpoints in the `.js` files instead of `.ts`
2. **Use runtime transpilers** - Tools like `tsx` or `ts-node` that handle TypeScript at runtime:
   ```json
   {
     "tool": "start_debugging",
     "params": {
       "sessionId": "session-id",
       "scriptPath": "app.ts",  // Works with tsx/ts-node installed
       "args": []
     }
   }
   ```

For technical details and planned improvements, see [TypeScript Source Map Investigation](./typescript-source-map-investigation.md).

### Other Limitations

- Browser/Chrome debugging not yet supported (Node.js via `pwa-node` only)
- Remote debugging requires manual configuration
- Some advanced DAP features may not be exposed through MCP tools

## Examples

See `/examples/javascript/` for complete examples:

- `simple_test.js` - Basic variable swap example
- `pause_test.js` - Testing pause functionality
- `test_javascript_debug.js` - Comprehensive test suite

## Implementation Details

The JavaScript adapter uses:
- **Vendor**: Microsoft's `js-debug` from VSCode
- **Entry point**: The factory launches `vsDebugServer.cjs` as its first priority; `vsDebugServer.js` is used as a fallback if the `.cjs` file is not present
- **Protocol**: Debug Adapter Protocol (DAP)
- **Transport**: TCP for DAP communication between the proxy and the js-debug adapter process
- **Version**: The factory enforces Node.js 14+ as a minimum requirement; Node.js 18+ is recommended for best compatibility

For adapter development details, see the [Adapter Development Guide](../architecture/adapter-development-guide.md).
