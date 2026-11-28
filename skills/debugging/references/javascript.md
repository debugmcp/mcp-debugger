# JavaScript debugging (mcp-debugger)

## Prerequisites

- Node.js 22+ on PATH (or pass `executablePath` in `create_debug_session` to pick a specific Node).
- No debugger install needed — the adapter bundles Microsoft's js-debug (`pwa-node`, the VSCode Node debugger). Node.js targets only; browser/Chrome debugging is not supported.
- TypeScript: `.ts` files debug directly if `tsx` or `ts-node` is found (in `node_modules/.bin` or PATH). Otherwise debug the compiled `.js` — source maps still resolve breakpoints set in `.ts` files.
- Always use absolute file paths.

## Launch quickstart

```text
create_debug_session { "language": "javascript", "name": "js-bug-hunt" }
  -> returns sessionId

set_breakpoint  { "sessionId": "<id>", "file": "/abs/path/app.js", "line": 3 }
start_debugging { "sessionId": "<id>", "scriptPath": "/abs/path/app.js" }
  -> should stop at your breakpoint; if it stops in a Node internal frame instead,
     call continue_execution to advance to user code

get_stack_trace { "sessionId": "<id>" }          # shows app.js, internals filtered out
evaluate_expression { "sessionId": "<id>", "expression": "a * b" }
step_over       { "sessionId": "<id>" }
get_local_variables { "sessionId": "<id>" }       # filters `this`, `__proto__`, V8 internals
continue_execution { "sessionId": "<id>" }
get_output      { "sessionId": "<id>" }           # console.log / stderr; pass since=nextSince to poll
close_debug_session { "sessionId": "<id>" }
```

Pass environment, script args, or cwd through `dapLaunchArgs`:

```text
start_debugging {
  "sessionId": "<id>", "scriptPath": "/abs/path/app.js",
  "dapLaunchArgs": { "env": { "NODE_ENV": "development" }, "cwd": "/abs/path", "stopOnEntry": false }
}
```

Conditional breakpoints are supported: `set_breakpoint { ..., "condition": "count > 5" }`.

Launching a runner by its file under `node_modules` (Vitest, Jest, Mocha) defaults `cwd` to the
folder containing the outermost `node_modules`, including nested pnpm paths. The launch's
`warning` names that directory; set `dapLaunchArgs.cwd` to override it, or change/remove
`adapterLaunchConfig.cwd` if present because it takes precedence. Relative runner programs
resolve against the launcher's working directory before this default is selected. Other programs
default to the directory containing `scriptPath`, even when `dapLaunchArgs.program` differs.
An explicit `cwd` is preserved and produces no default-directory notice.

`adapterLaunchConfig` accepts the same launch settings and wins over `dapLaunchArgs` for a shared
key, including `stopOnEntry`. Read the launch response's `warning`: it names ignored, malformed
or unrecognized keys and suggests likely spellings. Unknown keys are still forwarded. Notices
also appear in `get_output`; preparation failures retain them in `data.warning`.

`envFile: ".env.debug"` loads dotenv values relative to the effective `cwd`. File values override
inherited values, explicit `env` entries override the file, and `env: { "KEY": null }` removes a
variable. File/explicit `NODE_ENV` and `NODE_OPTIONS` values take effect too. A missing file warns;
other read errors fail the launch.

## Attach / remote

Start the target Node process with the inspector listening, then attach by port:

```bash
node --inspect=9229 server.js        # or --inspect-brk=9229 to pause at first line
```

```text
create_debug_session { "language": "javascript" }
attach_to_process    { "sessionId": "<id>", "host": "127.0.0.1", "port": 9229 }
set_breakpoint       { "sessionId": "<id>", "file": "/abs/path/server.js", "line": 42 }
continue_execution   { "sessionId": "<id>" }
```

Shorthand: `create_debug_session { "language": "javascript", "host": "127.0.0.1", "port": 9229 }` attaches in one call (`processId` or `adapterConfig.websocketAddress` trigger it too, with every attach argument `attach_to_process` takes). Attach is verified by polling for threads (`verifyTimeout`, default ~20000 ms). Detach with `detach_from_process { "sessionId": "<id>", "terminateProcess": false }`; remote debugging beyond a reachable host/port requires manual configuration (e.g. an SSH tunnel).

**By PID**, for a plain `node server.js` on the same host that was *not* started with `--inspect`:

```text
attach_to_process    { "sessionId": "<id>", "processId": 48213 }
```

mcp-debugger signals the process (`SIGUSR1` / `process._debugProcess`), which opens its inspector on `127.0.0.1:9229`, checks the port now belongs to that PID, and attaches there. A target started with `--inspect-port=<n>` opens on `<n>` instead — pass `"port": <n>` with the PID. Without it the attach looks at 9229 and fails, saying it signalled and closed nothing; the inspector the signal opened on `<n>` then stays open until the target restarts (#1310), so tell the user, and retry with the port (that attach finds it open and leaves it open). While the session lasts the inspector is open and unauthenticated (any local process can connect to it and run code in the target). The session that opened it closes it when it detaches or closes (#1261), and the answer's `inspector` field says what was done: `closed: …`, or `left open: …` for an inspector that was already open or that another session of this server still uses. To attach again, attach by PID again — the signal opens it again; a re-attach by `port: 9229` finds nothing there. If an answer says `not confirmed closed`, tell the user the port may still be open. Refused by name: a non-loopback host, a PID that is not a Node.js process (SIGUSR1 would kill it), a port held by another process's inspector, and a host PID from inside the Docker image.

## Quirks

- **Child-session architecture.** js-debug runs a parent session for launch orchestration and spawns a child session for the actual debuggee. This is invisible to you: the proxy routes evaluate/step/stack commands to the active context automatically. Never create a second MCP session for the "other" half.
- **Entry pause auto-continues.** With `stopOnEntry: false` (the default) the debugger automatically continues past entry breakpoints, so execution runs straight to your first breakpoint. A breakpoint reached as the program starts is in the `start_debugging` answer; one reached later — a route handler, a timer — leaves the launch answering `pending: true`, and `wait_for_stop` collects it. Set `dapLaunchArgs: { "stopOnEntry": true }` only when you want control at the first line — and read `lastStop.text` when you get it: for a file whose first declaration is a function the program calls later, js-debug's entry breakpoint resolves *inside that function*, so the "entry" stop is its first call (top-level code before it has already run) and every later call stops as "entry" again. The text says so; a line breakpoint on the first statement is the reliable way to stop there.
- **Stack filtering hides Node internals.** `get_stack_trace` returns user frames only by default; pass `includeInternals: true` if you genuinely need Node.js internal frames. If execution initially stops inside internals, just `continue_execution`.
- **TypeScript auto-detection.** Point `scriptPath` at the `.ts` file when `tsx`/`ts-node` is available. If neither is installed you get a warning (not an error) — fall back to the compiled `.js` with source maps.
- **JavaScript child processes.** Launches debug the processes the program starts by default. An attach does not debug the processes the target starts afterwards unless asked. `adapterConfig: { autoAttachChildProcesses: true }` debugs them as child sessions for a target reached through a local endpoint, but it changes the target: each process the target starts from then on is made to load a file from this server (through `NODE_OPTIONS`) and to wait at startup until the debugger has attached to it. So such a process can fail to start if the target cannot load this server's file (for example, through a localhost port forward), starts late when the target forks faster than the debugger attaches, and can be left waiting if it is forked during a detach (#1286). With it enabled, every Node process the program forks or spawns becomes a child debug session of its own (`parentSessionId`, the parent's breakpoints, reported by the parent's `wait_for_stop` with its `sessionId`). Pass `autoAttachChildProcesses: false` in `dapLaunchArgs` to keep children undebugged; set it explicitly to `true` on attach only when the target and its children can load the server's js-debug bootloader and reach its debugger endpoint. A launch child's output is on the launch session's buffer (`get_output` answers `outputOn`); an attach child keeps its own console output without an `outputOn` pointer. Closing a child releases it to run on. A child's first stop that js-debug mislabels as a "debugger statement" pause on a line without one is verified against the source and resumed before you see it (#1097); a real `debugger;` is still a breakpoint stop.
- **Output capture works** (`outputCapture: 'std'`): stdout/stderr appear as `get_output` entries; entries without a category default to `console`.
- **Frame IDs are adapter-assigned.** Use the `id` field from `get_stack_trace` frames for `get_scopes` — not the array index, not 0. Locals scopes are named `Local`/`Block`, and values come back as strings.
- Logpoints work: `set_breakpoint` with `logMessage: "x={x}"` logs interpolated values to `get_output` (category `console`) without pausing. Each hit costs about 215 µs (22% of a core at 1,000 hits/s, ~4,600 hits/s ceiling), and any logpoint in a function slows that whole function (by 2.57× on the measured loop, about 8× on a tighter one) — keep logpoints off tight loops ([docs/tool-reference.md#logpoints](https://github.com/debugmcp/mcp-debugger/blob/main/docs/tool-reference.md#logpoints)). mcp-debugger compiles them itself and delivers them over the inspector, so they survive a program that replaced `console.log` (an MCP stdio server, for one), a `condition` gates the log instead of pausing, strings print raw and objects through `util.inspect`, and a malformed `{expression}` is refused at `set_breakpoint` with the syntax error. A logpoint set before launch adds a hidden entry stop that is auto-continued; nothing to wait for.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Breakpoint never hits | Relative/mismatched path, or the line never executes | Use absolute paths; confirm the code path runs; for `.ts` confirm source maps or a TS runner |
| Session fails to start | Node not found or script has a syntax error | Check Node on PATH or pass `executablePath`; run the script plainly first |
| Stopped in a Node internal frame at start | Debugger paused before reaching user code | `continue_execution` — it will run to your breakpoint |
| `.ts` debugging fails | No `tsx`/`ts-node` available | Install one, or debug the compiled `.js` output |
| Variables empty / "Session is not paused" | Inspection while running | Call `wait_for_stop` (it blocks until the program pauses), then use frame IDs from `get_stack_trace` |
| Attach connection refused | Target not started with `--inspect=<port>` or port unreachable | Attach by `processId` instead (local Node.js process), or restart the target with the inspector flag; verify the port |
| PID attach says 9229 is held by a different process | Another Node inspector already owns the default port | If a session of yours is attached by PID to that other process, detach or close it (that closes the inspector it opened); otherwise pass `port` if the target was started with `--inspect-port=<n>`, or free 9229 |
| Need adapter diagnostics | — | Relaunch with `dapLaunchArgs: { "trace": true }` |
