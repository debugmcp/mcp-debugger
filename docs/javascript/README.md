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
- **Skipped code**: Node internals and, by default, `node_modules` (see below)
- **Source maps**: On by default, for `.js` programs as well as `.ts` (see [TypeScript Support](#typescript-support))

### Stepping and pausing inside dependencies (`justMyCode`, `skipFiles`)

js-debug has no `justMyCode` key of its own; the launch transform turns the intent into js-debug's
`skipFiles` (V8 blackboxing), and js-debug **resumes any pause or step that lands in a skipped frame**, stepping
out into a synchronous caller — on a request path, node internals — rather than waiting for your code to run
(issue #678). What that means in practice:

| Launch | `skipFiles` sent | `smartStep` | A breakpoint inside a dependency | `step_over` from that breakpoint | `pause_execution` on an idle server |
|---|---|---|---|---|---|
| default (`justMyCode: true`) | `<node_internals>/**`, `**/node_modules/**` | `true` | fires; frame 0 is the dependency frame | does not land on a request path (`pending: true`; the message names the skipped frame and the remedy) | does not land (`pending: true`; the message says node_modules is blackboxed and what to do) |
| `dapLaunchArgs: { justMyCode: false }` | `<node_internals>/**` | `false` | fires | lands on the next line of the dependency | lands as soon as any JavaScript runs (the next request or timer), in an internal frame if that is where it is (the stack response marks it). With the smart-stepper off, steps also stop in unmapped generated helpers it used to skip |
| `dapLaunchArgs: { skipFiles: [...] }` | exactly your list | as above | — | — | — |

A caller-supplied `skipFiles` **replaces** the default list (VS Code's launch.json semantics); include
`<node_internals>/**` yourself if you still want internals skipped. An explicit `smartStep` always wins over the
derived value. Attach sessions default neither key — see `attach_to_process` in the tool reference.

A step whose stop is a breakpoint or an exception rather than the step itself is reported as
`Step stopped on 'breakpoint'` with a `stopReason` — the location is where the program stopped, which is the
next line when that line carries a breakpoint, and the very line you stepped from when a lost step's next request
re-hit the same breakpoint (the message then says so).

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

Source maps are on by default for every launch, `.js` programs included (js-debug's own default; issue #684).
Launching a compiled TypeScript app from `dist/index.js` with `dist/**/*.js.map` beside it and `src/**/*.ts` on
disk therefore behaves like debugging the sources: breakpoints set in `src/*.ts` bind and verify under their own
path, and `get_stack_trace`, `get_local_variables`, `evaluate_expression`, `get_source_context` and every step
location report `src/*.ts` lines. The default `outFiles` is `**/*.js` excluding `node_modules`, and
`resolveSourceMapLocations` excludes `node_modules` too, so dependency maps are not applied. A program without
maps is unaffected. A map whose sources are not on disk yields frames flagged `unresolvedSource` (issue #655).

To see generated locations instead, pass `adapterLaunchConfig: { sourceMaps: false }`; `outFiles` you pass with it
is forwarded untouched. A breakpoint you set in a generated file still binds and fires with maps on; js-debug then
reports that one frame at its generated location while the frames below it map to their sources.

If neither `tsx` nor `ts-node` is installed, the factory emits a warning (not an error), and you can still debug compiled `.js` files with source maps.

## Known Limitations

- Browser/Chrome debugging not yet supported (Node.js via `pwa-node` only)
- Remote attach works over `host`/`port` against a `node --inspect=0.0.0.0:<port>`
  target, including pods via `kubectl port-forward` (see
  [attach presets](../../examples/kubernetes/attach-presets.md)); the target must be
  started with the inspector enabled, which mcp-debugger cannot do for you
- Attach pauses the target unless you pass `stopOnEntry: false`. js-debug's pause
  lands on the next event-loop dispatch, so an idle server answers
  `state: "running", pending: true` (the `message` names the pending pause) and
  freezes on its next request — attach to a live server with `stopOnEntry: false`
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
  note — pass `includeInternals: true`. A stop *inside* a dependency — a
  breakpoint, a step, a `debugger;` statement, or any stop whose only visible
  ancestors sit beyond an `await`/request boundary — keeps that frame as frame
  0 (reported as `pausedFrame`, and the `note` says so) so `get_local_variables`
  and `evaluate_expression` work where the program stopped (issue #672)
- **Breakpoints in source-mapped TypeScript bind under the generated file.**
  A launch breakpoint set on `src/x.ts:349` is verified by js-debug under
  `dist/x.js:277`; `list_breakpoints` keeps the request as `file`/`line` and
  reports the generated location as `boundFile`/`boundLine`, and `verified`
  flips to true. A breakpoint the program stops on is reported verified from
  that stop even when js-debug never sent a verification for it (observed for
  `node_modules` files) — issue #673
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
