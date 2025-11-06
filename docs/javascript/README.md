# JavaScript/TypeScript Debugging Guide

## Overview

The JavaScript adapter provides full debugging support for Node.js applications using Microsoft's proven `js-debug` (pwa-node) debugger from VSCode. This includes support for:

- Node.js applications
- TypeScript with source maps
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
- **Source Maps**: Automatically enabled for TypeScript
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

## TypeScript Support

TypeScript is fully supported with automatic source map resolution:

```typescript
// app.ts
interface User {
  name: string;
  age: number;
}

function greetUser(user: User): string {
  const message = `Hello, ${user.name}!`;  // Breakpoint works here
  return message;
}
```

No special configuration needed - the adapter automatically handles:
- Source map resolution
- Path mapping
- TypeScript compilation artifacts

## Advanced Features

### Child Process Debugging

The adapter automatically attaches to child processes:

```javascript
// parent.js
const { spawn } = require('child_process');

const child = spawn('node', ['child.js']);
// Debugger will automatically attach to child.js
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
   - Check that source maps are generated for TypeScript
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
  "tool": "create_debug_session",
  "params": {
    "language": "javascript",
    "name": "Debug with Logging",
    "dapLaunchArgs": {
      "trace": true
    }
  }
}
```

## Limitations

Current limitations of the JavaScript adapter:

- Chrome debugging (`chrome-pwa`) not yet supported (Node.js only)
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
- **Protocol**: Debug Adapter Protocol (DAP)
- **Transport**: Stdio communication with adapter
- **Version**: Compatible with Node.js 14+

For adapter development details, see the [Adapter Development Guide](../architecture/adapter-development-guide.md).
