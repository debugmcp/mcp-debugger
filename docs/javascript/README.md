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
source maps (an unmapped helper of a source-mapped file) all count. It is asked at every landing, so in a bundle the
dependency's lines are skipped and your own lines of the same script are not; only a module of Node's own, one source
per script, is not asked about twice.

A `step_into` that lands in skipped code walks on, one engine step at a time, until your code is on top again or the
walk has taken 512 engine steps in skipped code; then it steps out. The walk has no time bound: where a step lands
is decided by the program, never by the clock, so the same step lands in the same place on any host. What the host
changes is how long the walk takes. An engine step costs about 1.6 to 2.5 ms through the server on Windows and
about 44 ms on Linux (issue #1163), so on Linux a long walk outlasts the step's 5 s grace window: the step answers
`pending: true` with a sentence saying the stepper is walking through skipped code, and
[`wait_for_stop`](../tool-reference.md#wait_for_stop) answers where it lands (the first `console.log` of a process:
`pending`, then the next line after about 17 s; measured times below).

What a step does when the session steps through skipped code (the launch default):

| Step | From | Lands |
|---|---|---|
| `step_into` | a line that calls your function through skipped code (`emitter.emit` to an `on` or `once` listener, an array callback, a route handler from inside express) | in that function, when the walk reaches it within 512 engine steps, on Windows and Linux alike. Measured through the server on Windows: 11 engine steps to an `on` listener, 35 to a `once` listener, 84 to a custom `util.inspect` function behind a later `console.log`. A function of yours that the call reaches only further in is not entered: the step steps out, as in the next row |
| `step_into` | a line whose call stays in skipped code (`console.log`) | where the call returned: the next line, or the line's next statement. A walk that comes back out by itself is a plain `Stepped into`. One that takes all 512 engine steps steps out, and the step's answer says so, and that code of yours the call runs further in or only schedules (a timer callback) did not stop the step; where that walk outlasts the 5 s window (Linux) the step's answer is the `pending` one, and the sentence comes with the landing instead: the `wait_for_stop` answer that follows says `Paused (step) at …` and carries it in `lastStop.text`. Measured through the server on Windows, the walk comes back out by itself: about 390 engine steps for the first `console.log` of a process, 130 for a later one. On Linux the same walks take longer and answer `pending` first (below) |
| `step_into` | a line that goes on after the call (`console.log(a); console.log(b);`, a one-line `for … of` loop) | at the next position on that line where your code runs: the next statement, or the loop header's next position, in the first iteration. `step_into` again goes on |
| `step_into` | a `require` line | not where the call returned, on today's Node versions: Node's loader returns through `try … finally`, so stepping back out of it is one of the steps V8 loses (issue #1161, below). The first load of a module of yours is lost and the program runs on. In the measured cases of a built-in module or one already loaded (`require('node:fs')`, a second `require` of a loaded file, on Windows), the walk ended on its step bound inside the loader and the step stopped further down the same function, with the lines between run, as without the server's stepper. Use `step_over` on a `require` line (it lands on the next line), or set a breakpoint in the module |
| `step_into` | a line that calls native code only (`JSON.stringify`) | on the next line, as a plain `Stepped into`: there is nothing to walk into |
| `step_into` | a line that only starts a later task (`setTimeout`, a `.then` callback) | on the next line, never in the callback some time later; a breakpoint in the callback stops there |
| `step_over`, `step_out` | a frame whose caller is skipped code, with your code further down the stack | in that frame of yours |
| `step_out` | an `async` function the event loop resumed | in the function that awaits it, in the call that awaited (V8's own step). Not for TypeScript compiled for a target below ES2017 (issue #1165): there the step does not land in the awaiting function, and the program runs on to the next breakpoint or its end |
| `step_over`, `step_out` | the last line of a function that nothing of yours called or awaits (a request handler, a timer callback, a `.then` callback) | nowhere of its own: nothing of your program is on the stack. If another callback of yours is already queued behind a `.then` callback, V8's step stops in it; otherwise the program is resumed, and the answer is the next stop if one comes while the step waits (a breakpoint, the program's end), or `pending: true` if none does (with a sentence saying the step left its frame, on an attach with `smartStep: true` too) |
| any step | skipped code (a breakpoint inside a dependency) | `step_into` walks on, into your handler when the walk reaches it within 512 engine steps. `step_over` and `step_out`: when your code called the dependency, in your caller at once, where the call returned; when nothing of yours is on the stack (a request path inside a framework), the program runs on, as in the row above. `justMyCode: false` steps inside that code |

A breakpoint or an exception reached during a step stops as itself. A `debugger;` statement reached during a step is
reported as the step's landing: V8 reports the two alike, and it is where the program stopped. (A `debugger;` in
skipped code does not stop at all, with or without a step in flight.) A pause asked for while a step
is still pending is the caller's: the next stop is reported as the pause, where the program is, in Node's own code
if that is where it is (the stack response marks the frame). A step never steps away from it. One case is not yet
so (issue #1208): when a `step_into` is pending because the program is blocked in native code or idle, the pause
stops inside the expression the server evaluates to wake the program before a pause, and is reported as a step at
`repl:1`. A pending `step_over` of a call of your own that blocks or loops is not affected: the pause stops in it.

| Launch | `skipFiles` sent | Steps through skipped code | `step_over` from a breakpoint inside a dependency |
|---|---|---|---|
| default (`justMyCode: true`) | `<node_internals>/**`, `**/node_modules/**` | yes | lands in your caller when your code called the dependency; runs on when nothing of yours is on the stack (`pending: true`; the message names the skipped frame and the remedy) |
| `dapLaunchArgs: { justMyCode: false }` | `<node_internals>/**` | no | lands on the next line of the dependency |
| `dapLaunchArgs: { skipFiles: [...] }` | exactly your list | follows `justMyCode` unless `smartStep` is set | lands unless the frame is on your list |
| `adapterLaunchConfig: { smartStep: false }` (default list) | `<node_internals>/**`, `**/node_modules/**` | no | lands in the next frame V8 does not skip (an internals frame on a request path) |

A caller-supplied `skipFiles` **replaces** the default list (VS Code's launch.json semantics); include
`<node_internals>/**` yourself if you still want internals skipped. Without it Node's own code is program code to a
step: a `step_out` of a timer callback lands in Node's timer code. An explicit `smartStep` always wins over the
derived value. Attach defaults `smartStep` to `false` and leaves `skipFiles` unset (issue #513) — see
`attach_to_process` in the tool reference. With the stepping off, a step lands where V8 lands: a `step_into` on a
`console.log` line stops in `<node_internals>`, and an `async` callee in TypeScript compiled for a target below
ES2017 costs four unmapped `__awaiter` stops before its first line (issue #687).

**Steps V8 itself loses** (issue #1161; in `async` functions and generators, issue #1174). V8 loses a step that
leaves a function through a `return` that runs a `finally` first: a `return` inside `try … finally`, a `return` out
of a `for … of` loop, a function with a `using` declaration, and every async generator. The steps lost are a
`step_out` of such a function, and a `step_over` or `step_into` off its last statement. Measured on Node 22.23.2,
24.14.1 and 26.9.0; Node 16.3.0 lands these steps, 16.4.0 and later do not. A step that crosses an `await` first
is not lost.

Such a step shows one of two symptoms:

- It never lands, and the program runs on or ends: the step answers `pending: true` while the program keeps
  running, or `"The step did not pause. The program ran to completion (exit code 0)."` (with `exitCode`) when it ends first.
- A `step_over` off the end of a `finally` block can instead stop in the next call of the same function, not in
  the caller. Check the stack before you take that stop for the caller.

The server does not rescue these steps and sets no temporary breakpoints for them: a breakpoint hit in the caller
cannot be told from a hit in a later call of the caller, so the step is V8's own. To get past such a return, set a
breakpoint on the line where you expect execution to come back, then `continue_execution`. The fix is in V8 16.0
(V8 issue 569814973, tracked here as issue #1173). No Node release has it yet: it reaches you only through a Node
release whose V8 has it. With it these steps land in the caller, and a `step_over` off the end of a `finally` block
first stops once more at the end of the `return`, with the value it returns, as V8 stops at any `return`.

A different loss, in js-debug: a `step_over` across the first load of a module that has a breakpoint in it runs on
(issue #1162). js-debug pauses at the module's entry to bind the breakpoint and resumes that pause itself while the
step is in flight, and the step is lost with it.

On Linux every engine step costs about 44 ms whoever sends it (the inspector's socket; issue #1163), against about
1.6 to 2.5 ms through the server on Windows. The steps land in the same places there; they take longer, and a long
walk answers `pending` first. Measured (time from the step's call to its landing, the `pending` answer and the
`wait_for_stop` after it included; three runs each; Windows under Node 24 through the server, Linux on an Ubuntu
24.04 host with 2 vCPUs under Node 22):

| `step_into` on | Windows | Linux |
|---|---|---|
| the first `console.log` of a process | the next line, at once, 0.7 s | `pending`, then the next line, 16.8 to 17.2 s |
| a later `console.log` (issue #1130's own case) | the next line, at once, 0.3 s | `pending`, then the next line, 5.4 to 5.9 s |
| `console.log` of an object with a custom `util.inspect` function | in that function, at once, 0.2 s | in that function, at once, 4.6 to 4.7 s |
| `emitter.emit` to an `on` / a `once` listener | in the listener, at once, 0.1 s | in the listener, at once, 0.8 to 1.0 s / 2.0 to 2.1 s |
| express `next()` | in the next middleware, at once, 0.1 s | in the next middleware, at once, 1.0 to 1.1 s |
| `setTimeout(...)` | the next line, at once, 0.3 s | `pending`, then the next line, 7.2 to 7.7 s |
| `require('node:fs')`, a built-in | 512 engine steps, then the step out V8 loses: further down the same function, the lines between run, 0.8 to 1.0 s | the same place, `pending` first, about 25 s |
| `require('./mod')`, its first load | lost: the program runs to its end, 1.1 to 1.2 s | the same, `pending` first, about 25 s |

The two `require` rows are where they were before the server's stepper too (issue #1161, above).

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

Without an explicit `cwd`, a program under `node_modules` runs from the folder containing its
outermost `node_modules`. Both `/project/node_modules/vitest/vitest.mjs` and
`/project/node_modules/.pnpm/vitest@1/node_modules/vitest/vitest.mjs` therefore run from `/project`,
so Vitest, Jest and Mocha can find the project's tests. The launch response's `warning` names the
directory used and explains the `dapLaunchArgs.cwd` override. If `adapterLaunchConfig.cwd` is
present, change or remove it because it takes precedence. Relative runner programs are resolved
against the launcher's working directory before selecting this default. Other programs default
to the directory containing `scriptPath`, even when `dapLaunchArgs.program` names a different
file; an explicit `cwd` always wins and produces no default-directory notice.

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

Child-process debugging is on by default for a Node launch; a JavaScript attach injects no bootloader into the target for processes it starts afterwards by default, preserving 0.26.0's off default. The opt-in and its startup and detach costs are described below (#1286). With it enabled, every Node process the program starts — a `fork()`, a `spawn(process.execPath, …)`, a `cluster` worker, a grandchild — becomes a child debug session of its own (the [session tree](../architecture/session-tree.md), issue [#1082](https://github.com/debugmcp/mcp-debugger/issues/1082), from the facts measured in [spike-notes-forks.md](spike-notes-forks.md)): listed by `list_debug_sessions` with `parentSessionId`, stopping on the breakpoints set on the parent before launch (re-sent to each child before it runs), reported by the parent's `wait_for_stop` with its `sessionId`. A child's first stop that js-debug reports as a "debugger statement" pause on a line without one — its own module-entry break leaking under load ([#1097](https://github.com/debugmcp/mcp-debugger/issues/1097)) — is verified against the source line and resumed before anything is answered; a real `debugger;` there is still reported as a breakpoint. Three things js-debug does differently from debugpy, all answered rather than hidden: what the tree writes to inherited stdio arrives on the launch session's buffer (`outputOn: <launch session id>` on the child's `get_output`), while piped stdio goes to the parent process and the child's own buffer carries its logpoint lines and notices; `close_debug_session` on a child releases it to run on (`released: true`) because js-debug cannot end a target it adopted; and a child the server does not adopt (beyond `DEBUG_MCP_MAX_CHILD_SESSIONS`, default 32, `0` off) is released by a throwaway attach-then-detach ([#501](https://github.com/debugmcp/mcp-debugger/issues/501)'s lever), since refusing js-debug's report would park it forever. Function breakpoints do not carry into a child (they are armed over CDP on the program's own target): the child's `list_breakpoints` shows each one unverified with "Function breakpoints are not armed in a child session", and a `set_breakpoint {function}` on a child's id is answered the same way, at once. js-debug has no request for them, so none is sent to a child's connection (issue [#1219](https://github.com/debugmcp/mcp-debugger/issues/1219)). Logpoints do carry, delivering their lines to the child's own session without writing to its stdout (issue [#1212](https://github.com/debugmcp/mcp-debugger/issues/1212)). The program's exit ends every process under it, a child paused on a breakpoint included (measured): the launch owns the tree, so keep the parent alive while you inspect a child.

An attach never scans for children that are already running (js-debug's `attachExistingChildren` is pinned off). That scan identifies a child by an inspector port in its arguments, and a child that inherited its parent's `--inspect` flag carries the parent's port, so the session it produced was a second connection to the parent under the child's name (measured 2026-11-26: pausing it paused the parent). To debug a process that has an inspector port of its own, attach to that port in a session of its own.

Opt in with `adapterConfig: { autoAttachChildProcesses: true }` on the attach for a target reached through a local endpoint: each Node process the target starts afterwards loads js-debug's preload through `NODE_OPTIONS` and waits at startup until the debugger attaches. The injected `NODE_OPTIONS` contain `--require …/bootloader.js` and `--max-old-space-size=4096`, which stay there for children started after a detach too; a child can fail to start if the target cannot load this server's preload (for example, through a localhost port forward), starts late when forks outpace debugger attaches (on a 2-vCPU Linux host forking four times a second, only 640 of 1,396 children completed their handshake within 5 s), and can be left waiting if forked during detach (#1286).

For an `attach_to_process` root, the default console capture delivers each child's console
output to that child's own buffer and resource; it does not return an `outputOn` pointer to the
root. A launch child's `get_output` and resource carry what the debugger itself produced for
that process (the lines of the logpoints it hit, notices) beside the pointer to the launch
session, where what it writes to inherited stdio is. What a child writes to a pipe (`fork` with
`silent: true`) is read by its parent process only and shows on no session; the note says so.
The bootloader is in
the attached process only a moment *after* the attach answers: js-debug sets `NODE_OPTIONS` and
`VSCODE_INSPECTOR_OPTIONS` in its environment over the inspector, with retries, so a child forked
inside that window runs unreported (measured on a slow CI runner). A program that forks on a
trigger right after being attached to with child auto-attach enabled should wait for
`process.env.VSCODE_INSPECTOR_OPTIONS` to appear, as the attach fixture does.

A logpoint in a fork is delivered the way one in the program is: each fork gets its own CDP
socket with the logpoint binding on it (issue
[#1212](https://github.com/debugmcp/mcp-debugger/issues/1212)). Its lines are on **the fork's own
session**, read with `get_output` on the child's id, and `get_output` on a session that has
children lists them in `children`, so a caller reading only the launch session sees which other
sessions to read. What a fork writes to inherited stdio stays where js-debug delivers it, on the
launch session (`outputOn` in the child's answer). The same holds for a `worker_threads` worker, which
js-debug also reports as a target of its own. Nothing is written to the fork's own stdout: the
compiled logpoint used to fall back to the fork's `console.log`, and a parent that parses its
child's stdout read the logpoint text as protocol (measured: it reported the protocol corrupted
and exited 3 instead of 0, and no session showed the lines).

No stop, hold or resume is added to deliver a logpoint. The binding is usually in a fork before
its first statement runs: the socket is asked for the moment the fork's `configurationDone` is
answered, and js-debug lets the fork run about 20 ms later. A hit that comes before the binding
is kept in the process and delivered, in order, as soon as the binding is in. What is kept is
bounded (1000 messages and 1,000,000 characters; when the binding goes in, a line says how many
did not fit) and sits on globals that are not enumerable. When the debugger lets go of a process
that runs on (a detach from an attached process, a closed fork or worker session) it first takes
out what it put in: what was kept, and the binding's function itself, which CDP's
`Runtime.removeBinding` leaves behind (measured: after a detach the process used to keep the
function; it now has neither). One exception, also measured: the logpoints stay set until the
adapter itself has detached, a few milliseconds later, and one that hits in between is kept and
never read. A logpoint hitting about a hundred times a second left one or two messages behind
at each detach; an idle one leaves none (#1233). The
end of a fork is reported after one round trip on its CDP socket (at most 500 ms): its last
lines were measured to arrive about 1 ms after the adapter's `terminated`. A fork that hits two
logpoints and exits at once delivered both lines in 12 of 12 runs with that wait, and in 0 of 12
without it. What is still lost: the lines of a process whose CDP socket never opens, or whose
socket is lost while it runs. If it was sent a logpoint and the socket could not be set up while
the process is still there, its session carries one `[mcp-debugger] Warning` line saying that
its logpoints are not delivered (a process that ended while the socket was being set up is not
warned about: nothing more will hit in it);
such a process keeps what it queued (within the bounds above) until it exits, because there is
no socket to take it out through. Function breakpoints are not armed in a fork (#1219, #1226).

The program's own process gains from the same change: a logpoint on its first statement used to
go out through its `console.log` (measured on an ES module: the line arrived as `stdout` in 12
of 12 runs, the binding not yet in), and is now delivered on the debugger's channel.

Opt out per launch with `dapLaunchArgs: { autoAttachChildProcesses: false }` or server-wide with
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

A `logMessage` turns the breakpoint into a logpoint: execution does not pause — the interpolated message (expressions in `{curly braces}`) arrives in the session output, readable via `get_output` as a `console` entry. Each hit costs about 215 µs (22% of a core at 1,000 hits/s, up to about 4,600 hits/s doing nothing else), and placing a logpoint anywhere in a function slows that whole function by 2.57×, so keep logpoints off tight loops; see [Logpoints](../tool-reference.md#logpoints) for measurement conditions and what was not measured.

mcp-debugger compiles JavaScript logpoints itself rather than handing the `logMessage` to js-debug (issues #850, #861, #853): js-debug would print through the debuggee's `console.log`, which a program that owns its stdout may have replaced, and would turn a logpoint with a `condition` into a pausing breakpoint. The compiled form delivers the rendered message over js-debug's CDP proxy — strings raw, other values through `util.inspect`, a throwing expression as `<ReferenceError: …>` — logs only when the `condition` holds, and never pauses. While the delivery binding is not in the process (the first milliseconds of a forked process, or a process whose CDP socket could not be opened) the message is kept in the process and delivered when the binding arrives; it is never printed through the program's `console.log` (issue #1212). A `logMessage` whose `{expression}` does not compile is refused by `set_breakpoint` with V8's syntax error; a `condition` js-debug rejects shows js-debug's message on the breakpoint in `list_breakpoints`. A logpoint set before launch makes js-debug stop on entry so the delivery binding is in place before the first hit; that stop is auto-continued and never reported.

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
  pass it as `port` alongside `processId`. The inspector **stays open after detach and
  close, until the process exits** ([#1261](https://github.com/debugmcp/mcp-debugger/issues/1261)).
  A later attach — by PID or by `port: 9229` — reuses it without a second signal, and so can
  anything else on the host: the inspector has no authentication, so any local process can
  connect to it and run code in the target, and while it holds 9229 an attach by PID to a
  different Node process is refused. The one way to close it today is to evaluate
  `process._debugEnd()` in the target while it is paused: the inspector closes and the
  process runs on, but the call is answered `Unable to evaluate` and the session then
  reports the program as ended ([#1262](https://github.com/debugmcp/mcp-debugger/issues/1262)).
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
open on its port (Node never closes it by itself) — a later attach by PID or by port reuses it,
and until the process exits it is exposed in the way described above.

## Known Limitations

- Browser/Chrome debugging not yet supported (Node.js via `pwa-node` only)
- Attach by PID leaves the target's inspector open after detach and close, unauthenticated,
  until the process exits ([#1261](https://github.com/debugmcp/mcp-debugger/issues/1261)); see
  [Attaching to a running Node.js process](#attaching-to-a-running-nodejs-process)
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
