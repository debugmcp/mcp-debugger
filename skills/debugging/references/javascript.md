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

Shorthand: `create_debug_session { "language": "javascript", "host": "127.0.0.1", "port": 9229 }` attaches in one call. Attach is verified by polling for threads (`verifyTimeout`, default ~5000 ms). Detach with `detach_from_process { "sessionId": "<id>", "terminateProcess": false }`; remote debugging beyond a reachable host/port requires manual configuration (e.g. an SSH tunnel).

## Quirks

- **Child-session architecture.** js-debug runs a parent session for launch orchestration and spawns a child session for the actual debuggee. This is invisible to you: the proxy routes evaluate/step/stack commands to the active context automatically. Never create a second MCP session for the "other" half.
- **Entry pause auto-continues.** With `stopOnEntry: false` (the default) the debugger automatically continues past entry breakpoints, so execution runs straight to your first breakpoint. Set `dapLaunchArgs: { "stopOnEntry": true }` only when you want control at the first line.
- **Stack filtering hides Node internals.** `get_stack_trace` returns user frames only by default; pass `includeInternals: true` if you genuinely need Node.js internal frames. If execution initially stops inside internals, just `continue_execution`.
- **TypeScript auto-detection.** Point `scriptPath` at the `.ts` file when `tsx`/`ts-node` is available. If neither is installed you get a warning (not an error) — fall back to the compiled `.js` with source maps.
- **Child processes are not auto-attached.** `autoAttachChildProcesses` defaults to `false`; pass it as `true` in `dapLaunchArgs` to debug `spawn`-ed Node children.
- **Output capture works** (`outputCapture: 'std'`): stdout/stderr appear as `get_output` entries; entries without a category default to `console`.
- **Frame IDs are adapter-assigned.** Use the `id` field from `get_stack_trace` frames for `get_scopes` — not the array index, not 0. Locals scopes are named `Local`/`Block`, and values come back as strings.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Breakpoint never hits | Relative/mismatched path, or the line never executes | Use absolute paths; confirm the code path runs; for `.ts` confirm source maps or a TS runner |
| Session fails to start | Node not found or script has a syntax error | Check Node on PATH or pass `executablePath`; run the script plainly first |
| Stopped in a Node internal frame at start | Debugger paused before reaching user code | `continue_execution` — it will run to your breakpoint |
| `.ts` debugging fails | No `tsx`/`ts-node` available | Install one, or debug the compiled `.js` output |
| Variables empty / "Session is not paused" | Inspection while running | Wait for `paused` state, then use frame IDs from `get_stack_trace` |
| Attach connection refused | Target not started with `--inspect=<port>` or port unreachable | Restart target with the inspector flag; verify the port |
| Need adapter diagnostics | — | Relaunch with `dapLaunchArgs: { "trace": true }` |
