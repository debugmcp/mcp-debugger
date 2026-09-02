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

A `logMessage` turns the breakpoint into a logpoint: execution does not pause — the interpolated message (expressions in `{curly braces}`) arrives in the session output, readable via `get_output`.

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

## TypeScript Support

The adapter has built-in TypeScript support. When the factory validates the environment, it auto-detects `tsx` and `ts-node` in both `node_modules/.bin` and system PATH. If a TypeScript runner is found, you can debug `.ts` files directly:

```json
{
  "tool": "start_debugging",
  "params": {
    "sessionId": "session-id",
    "scriptPath": "app.ts",
    "args": []
  }
}
```

Source maps are supported automatically when debugging compiled JavaScript -- breakpoints set in `.ts` files will resolve to the correct location in the generated `.js` if source maps are present.

If neither `tsx` nor `ts-node` is installed, the factory emits a warning (not an error), and you can still debug compiled `.js` files with source maps.

## Known Limitations

- Browser/Chrome debugging not yet supported (Node.js via `pwa-node` only)
- Remote attach works over `host`/`port` against a `node --inspect=0.0.0.0:<port>`
  target, including pods via `kubectl port-forward` (see
  [attach presets](../../examples/kubernetes/attach-presets.md)); the target must be
  started with the inspector enabled, which mcp-debugger cannot do for you
- Some advanced DAP features may not be exposed through MCP tools
- **Source-mapped frames you cannot open.** A package that ships `.js.map` files
  whose `sources` point at `.ts` files it did not ship makes js-debug report those
  frames with a relative label (`../src/shared/protocol.ts`) and a non-zero
  `sourceReference`; mcp-debugger marks them `unresolvedSource: true` and says so
  in the `note` (issue #655). On attach the common causes are already handled:
  `resolveSourceMapLocations` defaults to `["**", "!**/node_modules/**"]` so
  dependency maps are not applied (those frames show their real `.js` path), and
  `cwd` defaults to the server's working directory because js-debug resolves no
  relative map source without a base path — with it, the debuggee's own
  `dist/**` maps resolve to the absolute `src/**/*.ts` next to them. Knobs, all via
  `adapterConfig`: `sourceMaps: false` (generated `.js` paths everywhere),
  `resolveSourceMapLocations` (globs, or `null` for everywhere), `cwd`,
  `sourceMapPathOverrides`. `get_stack_trace` hides `node_modules` and async
  separator frames by default; a debuggee that is itself an installed package
  under `node_modules` shows its top frame plus an "all frames are internal"
  note — pass `includeInternals: true`
- Debuggee exit codes are captured via an injected preload (js-debug itself
  never emits a DAP `exited` event), so `exitCode` is unavailable in two
  cases: attach mode (the target's environment is not under mcp-debugger's
  control) and signal-killed debuggees (`process.on('exit')` never runs).
  A missing `exitCode` is never replaced with a guessed value.

## Examples

See `examples/javascript/` for runnable examples, including:

- `simple_test.js` - Basic variable swap example
- `pause_test.js` - Testing pause functionality
- `test_javascript_debug.js` - Comprehensive test suite

The directory contains further examples (attach targets, function-breakpoint fixtures, and TypeScript samples such as `typescript_test.ts`).

## Implementation Details

The JavaScript adapter uses:
- **Vendor**: Microsoft's `js-debug` from VSCode
- **Vendor artifacts**: `vsDebugServer.js` is the canonical vendored artifact produced by the build script. `vsDebugServer.cjs` is a CommonJS compatibility duplicate created alongside it. The factory's validation checks for `.js` (the canonical path), while runtime command construction prefers `.cjs` for CommonJS child-process compatibility
- **Protocol**: Debug Adapter Protocol (DAP)
- **Transport**: TCP for DAP communication between the proxy and the js-debug adapter process
- **Version**: The package requires Node.js 22+ (per the engines field); the factory checks >= 14 as a lower-bound runtime guard

For adapter development details, see the [Adapter Development Guide](../architecture/adapter-development-guide.md).
