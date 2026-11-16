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

js-debug has no `justMyCode` key of its own; the launch transform turns the intent into two keys: `skipFiles`, the
code a step does not stop in (Node internals always, `node_modules` while `justMyCode` is true), and `smartStep`,
whether steps step through skipped code at all. `justMyCode: false` takes `node_modules` off the list and turns
that stepping off.

**The server steps through skipped code itself** (issue #1130). js-debug's own smart stepper did it before, and is
now off for every session whatever `smartStep` says: it re-stepped with a flag that moves the step to a later task
and loses it (a `step_into` on the first `console.log` of a process ended the session), and it took one engine step
per statement of the skipped code (131 for one `console.log`, about 6 s on a Linux host). `smartStep` is read as the
session's choice instead, and a session that chose it has its steps served by the server over js-debug's raw CDP
socket. What "skipped" means is still js-debug's own verdict on the frame, so `justMyCode`, your own `skipFiles` and
source maps (an unmapped helper of a source-mapped file) all count.

What a step does when the session steps through skipped code (the launch default):

| Step | From | Lands |
|---|---|---|
| `step_into` | a line that calls your function through skipped code (`emitter.emit` to a listener, an array callback, a route handler from inside express) | in that function |
| `step_into` | a line that calls only skipped code (`console.log`, `require`, `JSON.stringify`) | on the next line; the message says the line called only skipped code |
| `step_into` | a line that only starts a later task (`setTimeout`, a promise callback) | on the next line; a breakpoint in the callback stops there |
| `step_over`, `step_out` | a frame whose caller is skipped code, with your code further down the stack | in that frame of yours |
| `step_over`, `step_out` | the last line of a function Node called (a request handler, a timer callback) | nowhere: nothing of your program is on the stack, so the program is resumed and the answer is `pending: true` with a sentence saying so; the next breakpoint stops it |
| any step | skipped code (a breakpoint inside a dependency) | `step_into` walks on into your handler; `step_over` and `step_out` run on as in the row above. `justMyCode: false` steps inside that code |

A breakpoint, an exception or a `debugger;` statement reached during a step stops as itself. A pause is never stepped
away from: it lands where the program is, in Node's own code if that is where it is (the stack response marks the
frame).

| Launch | `skipFiles` sent | Steps through skipped code | `step_over` from a breakpoint inside a dependency |
|---|---|---|---|
| default (`justMyCode: true`) | `<node_internals>/**`, `**/node_modules/**` | yes | runs on (`pending: true`; the message names the skipped frame and the remedy) |
| `dapLaunchArgs: { justMyCode: false }` | `<node_internals>/**` | no | lands on the next line of the dependency |
| `dapLaunchArgs: { skipFiles: [...] }` | exactly your list | follows `justMyCode` unless `smartStep` is set | lands unless the frame is on your list |
| `adapterLaunchConfig: { smartStep: false }` (default list) | `<node_internals>/**`, `**/node_modules/**` | no | lands in the next frame V8 does not skip (an internals frame on a request path) |

A caller-supplied `skipFiles` **replaces** the default list (VS Code's launch.json semantics); include
`<node_internals>/**` yourself if you still want internals skipped. An explicit `smartStep` always wins over the
derived value. Attach defaults `smartStep` to `false` and leaves `skipFiles` unset (issue #513) — see
`attach_to_process` in the tool reference. With the stepping off, a step lands where V8 lands: a `step_into` on a
`console.log` line stops in `<node_internals>`, and an `async` callee in TypeScript compiled for a target below
ES2017 costs four unmapped `__awaiter` stops before its first line (issue #687).

**Steps V8 itself loses** (issue #1161). V8 never pauses for a step that leaves a function through a `return`
written inside `try … finally` (measured on V8 12.4, 13.6 and 14.6 with a bare CDP client): a `step_out` of such a
function, or a `step_over` off its `finally` block, used to answer `Step completed as session exited.` Node's own
module loader has that shape, which is how a `step_into` on a `require` line was lost too. So a step never counts on
V8 alone to come back to a frame. Before a step can leave a frame that way, the server sets temporary breakpoints on
the frame the step returns to (the nearest frame of your program below, or the awaiting function of an `async`
one), and whichever pauses first is the landing. That is something the server does in your process: up to 24
temporary breakpoints for the length of one step, for every `step_out`, for a `step_over` or `step_into` in a
function whose text contains `finally`, and for a step that walks through skipped code. They are removed when the
step ends, however it ends. A function that returns to itself (recursion) gets none for `step_over` and
`step_into`, so that one shape keeps V8's own behaviour.

Not covered: a `step_over` across the first load of a module that has a breakpoint in it still runs on (issue
#1162; js-debug pauses at the module's entry to bind the breakpoint, and V8 drops the step at any pause). A
`step_into` on that line does land.

On Linux every engine step costs about 46 ms whoever sends it (the inspector's socket), against 1.5 ms on Windows,
so a `step_into` on a `console.log` line, which walks 24 engine steps into Node's code before it comes back, takes
over a second there.

A step whose stop is a breakpoint or an exception rather than the step itself is reported as
`Stepped over; stopped on 'breakpoint' rather than on the step itself (see stopReason)` — true both when the next
line carries a breakpoint and when a step that ran on re-hit the same breakpoint on the next request; in the second
case the program is back at the line you stepped from, and the message says so.

### Custom Configuration

You can provide custom DAP launch arguments:

```json
{
  "tool": "start_debugging",
  "params": {
    "sessionId": "session-id",
    "scriptPath": "/path/to/project/app.js",
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

Both `dapLaunchArgs` and `adapterLaunchConfig` accept launch settings. When the same key appears
in both, `adapterLaunchConfig` wins, including `stopOnEntry`. Setting it to `true` keeps the target
paused at entry; `restart_debugging` replays that intent. An honoured `noDebug` disables the entry pause.

**Where the entry stop lands** (issue #858): js-debug implements `stopOnEntry` with a breakpoint at line 1,
column 1 of the program, and V8 resolves that to the first breakable position in *source* order. For a file
whose first declaration is a function that the program calls later, that position is inside the function —
so the "entry" stop fires at the function's first call, after the top-level code before it has run (output
included), and fires again at every later call. mcp-debugger cannot move the stop, but it says so: the
stop's `lastStop.text` (in `wait_for_stop`, `get_stack_trace` and `list_debug_sessions`) explains
where it landed and why. To stop at the first statement, put a statement above the function or set a line
breakpoint on it. A function breakpoint on that first-declared function is not affected: the stop that
binds it *is* the function's first call, and it is reported as the function breakpoint. Reported upstream as
[vscode-js-debug#2430](https://github.com/microsoft/vscode-js-debug/issues/2430). Node's `--inspect-brk` is not an alternative: js-debug strips it from `runtimeArgs`
into `stopOnEntry`, so a bare `--inspect` or `--inspect-brk` in `adapterLaunchConfig.runtimeArgs` is
forwarded as given and changes nothing about the entry stop.

Use `envFile` to load dotenv values relative to the effective `cwd`, then override individual values
with `env`. A `null` value removes an inherited or file-defined variable:

```json
{
  "sessionId": "session-id",
  "scriptPath": "/path/to/project/app.js",
  "adapterLaunchConfig": {
    "cwd": "/path/to/project",
    "envFile": ".env.debug",
    "env": { "PORT": "3001", "LEGACY_FLAG": null },
    "stopOnEntry": true
  }
}
```

Environment precedence is inherited values, then the existing `NODE_ENV=development` fallback,
then the file, then explicit `env` entries. File or explicit values for `NODE_ENV` and `NODE_OPTIONS`
take effect in the target; mcp-debugger adds its exit-code recorder after these overrides. Windows
environment keys match without regard to case. A missing file warns and continues; another read
error fails the launch. Loading a file never changes the server's own environment.

Check the response's `warning` for ignored, malformed or unrecognized options. For example,
`sourceMapPathOverides` remains forwarded but warns with the suggestion `sourceMapPathOverrides`;
`runtimeArgs: "--inspect"` warns because it needs an array. The warning names the input object and
key without quoting its value. Notices also reach `get_output`, appear on dry runs, and survive
preparation failures in `data.warning`. Each new launch clears prior notices.

The [launch configuration self-debugging example](launch-config-self-debug.md) demonstrates how
to inspect these decisions inside a running mcp-debugger server.

## Advanced Features

### Child Process Debugging

Child-process debugging is on by default for a Node launch and a verified-local attach (`autoAttachChildProcesses: true`). With it enabled, every Node process the program starts — a `fork()`, a `spawn(process.execPath, …)`, a `cluster` worker, a grandchild — becomes a child debug session of its own (the [session tree](../architecture/session-tree.md), issue [#1082](https://github.com/debugmcp/mcp-debugger/issues/1082), from the facts measured in [spike-notes-forks.md](spike-notes-forks.md)): listed by `list_debug_sessions` with `parentSessionId`, stopping on the breakpoints set on the parent before launch (re-sent to each child before it runs), reported by the parent's `wait_for_stop` with its `sessionId`. A child's first stop that js-debug reports as a "debugger statement" pause on a line without one — its own module-entry break leaking under load ([#1097](https://github.com/debugmcp/mcp-debugger/issues/1097)) — is verified against the source line and resumed before anything is answered; a real `debugger;` there is still reported as a breakpoint. Three things js-debug does differently from debugpy, all answered rather than hidden: the whole tree's output arrives on the launch session's buffer and none of it on a child's — a child's `get_output` answers `outputOn: <launch session id>`; `close_debug_session` on a child releases it to run on (`released: true`) because js-debug cannot end a target it adopted; and a child the server does not adopt (beyond `DEBUG_MCP_MAX_CHILD_SESSIONS`, default 32, `0` off) is released by a throwaway attach-then-detach ([#501](https://github.com/debugmcp/mcp-debugger/issues/501)'s lever), since refusing js-debug's report would park it forever. Function breakpoints do not carry into a child (they are armed over CDP on the program's own target); logpoints do, printing into the launch session's output. The program's exit ends every process under it, a child paused on a breakpoint included (measured): the launch owns the tree, so keep the parent alive while you inspect a child.

To choose the default, every attach form, including `processId`, verifies that the inspector
target can read both a temporary probe file created by the server and the installed js-debug bootloader files
(`bootloader.js` and `watchdog.js`). A loopback address or shared PID namespace alone is not
enough: `localhost` can be an SSH or `kubectl` port forward, and a sidecar can share PIDs without
sharing files. When that access cannot be verified, including a failed probe, child auto-attach
defaults to `false` and the attach response warns. This keeps
js-debug from injecting a server-local bootloader path into a remote or container target, which
can make later forks fail to start. An explicit `adapterConfig: { autoAttachChildProcesses: true }`
still enables it; use that override only when the target and its children can load the server's
js-debug bootloader and reach its debugger endpoint.

For an `attach_to_process` root, the default console capture delivers each child's console
output to that child's own buffer and resource; it does not return an `outputOn` pointer to the
root. A launch child's output resource still includes any diagnostics recorded for that child
alongside the pointer to the launch output. One hazard of an attached target started with
`node --inspect`: a child it `fork()`s inherits that flag through `execArgv` by default, fights
the parent for the inspector port, and js-debug's process-tree scan then attaches it as a
nameless `Child Process [<pid>]` target whose breakpoints never bind, racing the bootloader's own
report (seen on a slow CI runner). Fork with `execArgv: []` in a program that is attached to this
way; the bootloader reaches the child through `NODE_OPTIONS` regardless. And the bootloader is in
the attached process only a moment *after* the attach answers: js-debug sets `NODE_OPTIONS` and
`VSCODE_INSPECTOR_OPTIONS` in its environment over the inspector, with retries, so a child forked
inside that window runs unreported (measured on a slow CI runner). A program that forks on a
trigger right after being attached to with child auto-attach enabled should wait for
`process.env.VSCODE_INSPECTOR_OPTIONS` to appear, as the attach fixture does.

Fork logpoints use a `console.log` fallback because each fork does not have its own CDP logpoint
bridge. A child that replaces `console.log` can suppress those messages; the program target's
CDP-backed logpoints are unaffected.

Opt out per launch with `dapLaunchArgs: { autoAttachChildProcesses: false }`, per attach with
`adapterConfig: { autoAttachChildProcesses: false }`, or server-wide with
`DEBUG_MCP_MAX_CHILD_SESSIONS=0` (the program's own target is still adopted; every fork is released
to run undebugged). Opted out, the children run as they did before the session tree: untouched by the
debugger, their output on the parent's buffer where the parent's pipes carry it.

```javascript
// parent.js
const { fork } = require('child_process');

const child = fork('child.js');
// child.js is a child debug session of parent.js's: set its breakpoints on the
// parent's session before launch, then wait_for_stop on the parent reports them
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

A `logMessage` turns the breakpoint into a logpoint: execution does not pause — the interpolated message (expressions in `{curly braces}`) arrives in the session output, readable via `get_output` as a `console` entry.

mcp-debugger compiles JavaScript logpoints itself rather than handing the `logMessage` to js-debug (issues #850, #861, #853): js-debug would print through the debuggee's `console.log`, which a program that owns its stdout may have replaced, and would turn a logpoint with a `condition` into a pausing breakpoint. The compiled form delivers the rendered message over js-debug's CDP proxy — strings raw, other values through `util.inspect`, a throwing expression as `<ReferenceError: …>` — logs only when the `condition` holds, and never pauses. A `logMessage` whose `{expression}` does not compile is refused by `set_breakpoint` with V8's syntax error; a `condition` js-debug rejects shows js-debug's message on the breakpoint in `list_breakpoints`. A logpoint set before launch makes js-debug stop on entry so the delivery binding is in place before the first hit; that stop is auto-continued and never reported.

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
location report `src/*.ts` lines. The default `outFiles` is `**/*.(m|c|)js` excluding `node_modules`, resolved
against the workspace root js-debug is given — the nearest directory above the program with a `package.json`,
else the program's directory (`adapterLaunchConfig: { __workspaceFolder }` overrides it; `outFiles: []` opts out
of the pre-launch breakpoint scan) — and
`resolveSourceMapLocations` excludes `node_modules` too, so dependency maps are not applied. A program without
maps is unaffected. A map whose sources are not on disk yields frames flagged `unresolvedSource` (issue #655).

To see generated locations instead, pass `adapterLaunchConfig: { sourceMaps: false }`; `outFiles` you pass with it
is forwarded untouched. A breakpoint you set in a generated file still binds and fires with maps on; js-debug then
reports that one frame at its generated location while the frames below it map to their sources.

If neither `tsx` nor `ts-node` is installed, the factory emits a warning (not an error), and you can still debug compiled `.js` files with source maps.

## Attaching to a running Node.js process

Three ways in:

- **By port** — the target was started with the inspector listening
  (`node --inspect=127.0.0.1:9229 server.js`): `attach_to_process { host, port }`.
  This is the remote form too, against `--inspect=0.0.0.0:<port>` or a pod via
  `kubectl port-forward` (see [attach presets](../../examples/kubernetes/attach-presets.md)).
- **By PID** (issue #871) — the target is a plain `node server.js` on the same host:
  `attach_to_process { processId }`. js-debug's DAP server has no PID step (in VS Code
  the process picker does it), so mcp-debugger does what the picker does: it signals the
  process (`SIGUSR1` on POSIX, `process._debugProcess` on Windows), which makes Node open
  its inspector on `127.0.0.1:9229`, confirms through the inspector's `/json/list` that the
  port now belongs to that PID, and attaches there. A target started with
  `--inspect-port=<n>` (or `NODE_OPTIONS=--inspect-port=<n>`) opens on that port instead:
  pass it as `port` alongside `processId`. The inspector **stays open after detach**, so a
  later attach — by PID or by `port: 9229` — reuses it without a second signal.
- **By inspector URL** (issue #896) — `attach_to_process { adapterConfig: { websocketAddress:
  "ws://127.0.0.1:9229/<uuid>" } }`, the `webSocketDebuggerUrl` that `http://host:port/json/list`
  reports. js-debug dials it directly; no `port` is needed, and a `host`/`port` beside it is
  ignored. `continueOnAttach` applies as on a port attach, so a target started with
  `--inspect-brk` runs briefly before the post-attach pause lands.

When js-debug refuses the attach request itself (its error response names the inspector it
could not reach), the attach fails at once with that text: `Failed to attach: The javascript
debug adapter rejected the attach request: …`. When it instead drops the DAP socket — what it
does after `Could not connect to debug target` — the attach fails during verification and
quotes that stderr line (issue #897).

What a PID attach refuses, by name: a non-loopback `host` (the signal is local); the server's
own PID; a PID that is not a Node.js process (on POSIX `SIGUSR1` would terminate it, so the
executable is checked first, and a PID that cannot be identified is not signalled either); a
Node.js process started with `--disable-sigusr1` (no handler is installed, so the signal would
terminate it — seen on its command line or in `NODE_OPTIONS` where those are readable, which
on Linux and macOS means a process of the same user; a hardened target of another user is the
one case the check cannot see); a port already held by another process's inspector or by
something that is not an inspector (pass `port` if the target listens elsewhere, or free it);
and, in the Docker image, a host PID — the container only reaches its own PID namespace.

Two side effects to expect in the target's own logs: the ownership check opens one short
inspector session, so the target prints `Debugger attached.` / `Debugger ending on …` once
before js-debug connects; and an inspector that was opened for an attach that then failed stays
open on its port (Node never closes it by itself) — a later attach by PID or by port reuses it.

## Known Limitations

- Browser/Chrome debugging not yet supported (Node.js via `pwa-node` only)
- Attach by PID activates the inspector on Node's default port unless the target set
  `--inspect-port`; two PID attaches to two different plain `node` processes on one host
  therefore need the second target started with `--inspect-port=<n>` and `port: <n>` passed
- Attach pauses the target unless you pass `stopOnEntry: false`. V8 lands a pause
  on the next JavaScript that runs, and an idle server runs none, so the server
  first schedules one no-op timer in the target (`setTimeout`, 150 ms, unref'd) and
  the pause lands when it fires (issue #1146): the attach answers `paused` in
  `process.processTimers`, with `note` saying no program frame is active (issue
  #900). `get_local_variables` returns that frame's own variables with
  `noProgramFrame: true` and a `note` saying they belong to it, not to your program
  (issue #1135). Continue and send a request, or set a breakpoint first.
  `pause_execution` lands the same way, on attached and launched programs. On a
  loaded machine the pause can land first inside an evaluation js-debug makes on
  its own account just after attaching: the frame is then a sourceless
  `<anonymous>` with the same `note`, and continuing carries on from it. A
  program the timer cannot wake — busy in native code, or one that replaced
  `setTimeout` — still answers `state: "running", pending: true`, and stops on its
  next JavaScript; until then breakpoint requests are held and answered `Held: a
  pause is pending…`, because js-debug sets a breakpoint by running code of its own
  in the target, which is where a pending pause would fire. Attach to a live server
  you still need to use with `stopOnEntry: false`
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
- **Where a source-mapped breakpoint is reported bound.** With maps on (the
  default), a launch breakpoint set on `src/x.ts:349` is verified by js-debug
  under that same `.ts` path and line: `list_breakpoints` reports it
  `verified: true` with no `boundFile`/`boundLine`, and `get_stack_trace`
  frames show `src/*.ts`. The bound pair appears only when js-debug answers
  under a different file. With `adapterLaunchConfig: { sourceMaps: false }`
  the same `.ts` request still binds — js-debug's breakpoint predictor reads
  the map beside the generated file regardless — but is verified under the
  generated `dist/x.js:277`, reported as `boundFile`/`boundLine` beside the
  untouched request, and the frames show `dist/*.js`; that is the shape issue
  #673 measured before maps were on by default (#684, #700). A breakpoint the
  program stops on is reported verified from that stop even when js-debug
  never sent a verification for it (observed for `node_modules` files) —
  issue #673
- **When the build is older than the source.** `set_breakpoint` echoes the
  line from the `.ts` you named, while js-debug binds it through the
  generated `.js`'s map; with a stale `dist/` the two disagree and every
  later line number is off. The server therefore looks for the compiled file
  behind a `.ts`/`.tsx`/`.mts`/`.cts` location — the nearest `tsconfig.json`
  that names an `outDir` (relative to `rootDir` when set, then with a leading
  `src/` stripped, then relative to the tsconfig directory; a per-directory
  config that only `extends` the root is walked past), the conventional
  `dist|build|out|lib` under the nearest `package.json` when no tsconfig
  names an outDir, then a sibling `.js` — keeps the first one whose `.js.map`
  lists the source, and when that file's mtime is older than the source's
  (by more than 2 s) adds a `warning` to the `set_breakpoint` answer and a
  `note` to the `start_debugging`/`step_*`/`wait_for_stop`/`pause_execution`
  answers, and to `get_stack_trace` for its top frame, naming both files and
  their mtimes (issues #938, #951). It is mtime-only and hedged ("may be
  stale"): a source saved without a content change reads as newer too, and
  an incremental build (`tsc -b`, `--incremental`, `tsc --watch`) does not
  re-emit for an unchanged content hash, so only a full rebuild or a real
  edit clears that one. A launch whose program is itself a `.ts` (tsx,
  ts-node, Node's type stripping) or a runner installed under `node_modules`
  (vitest, jest, mocha) is exempt: the sources run as they are. Before the
  launch nothing says how the program will run, so a pre-launch breakpoint
  in such a project can still warn against an old `dist/`. An attach to such
  a process is not yet exempt (the attach path does not learn the script
  until the `/json/list` title is carried through). Limits: tsconfig
  `extends` is not followed, and the map must be `<generated>.map` beside the
  generated file (`sourceMappingURL` is not parsed)
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
