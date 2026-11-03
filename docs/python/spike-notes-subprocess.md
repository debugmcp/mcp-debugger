# Python subprocess debugging — spike notes (issue #1005, part B)

The measured facts behind the session-tree design for Python: how debugpy reports a child process, what a second DAP client needs to debug it, and what each level's exit, `disconnect` and `terminate` do to the rest of the tree. Read [docs/python/README.md](README.md) for how subprocess debugging behaves today (children run undebugged unless `subProcess: true` is passed, #1008); this file is what the design in `docs/architecture/` will be built from.

Measured 2026-11-03 on Windows 11, Python 3.13.12, debugpy 1.8.20, mcp-debugger at `06b5a15f`, with a **throwaway DAP driver** (not the proxy worker): a Node script speaking DAP over TCP to one `python -m debugpy.adapter --host 127.0.0.1 --port <free port>`, opening a second (and third) client connection to the same port for each child, logging every frame per connection and keeping the adapter's own log (`DEBUGPY_LOG_DIR`). The launch request is the one `transformLaunchConfig` sends (`console: internalConsole`, `redirectOutput: true`, `justMyCode: true`, `stopOnEntry: false`) with `subProcess: true` explicit. Fixtures: `parent.py` starts `child.py` with `subprocess.Popen([sys.executable, …])` and either waits for it or exits at once; `child.py` loops five times over one statement (the breakpoint line) and optionally runs `grandchild.py` the same way; `mp_parent.py` uses `multiprocessing.Process` (spawn start method). Times are wall-clock milliseconds from the driver's start on a loaded box (another worktree's test suite ran alongside); read them as orders of magnitude.

## Verdict

Go. One adapter process serves the whole tree: a child is a second client connection to the adapter's own port that sends `attach { subProcessId }`, and from there it is an ordinary session — breakpoints, stops, `threads`, `evaluate`, its own `terminated`. Both report forms were measured, the cascade matrix is below, and the release lever is the reverse request's answer. What the spike does not decide is where the second connection lives in the worker (a second `MinimalDapClient` in the same process, or a child worker); nothing measured here forces either.

## How debugpy reports a child

- The child's interpreter is started under pydevd by the parent's debugpy (process table: `python …\debugpy\_vendored\pydevd\pydevd.py --port <adapter server port> --ppid <parent pid> --client 127.0.0.1 … --file child.py`). It connects to the adapter's server listener and is **parked before any user code** until a client attaches to it.
- The adapter links it to the parent by ppid and tells the parent's client (adapter log: `Server[pid=37012] is a subprocess of Client[1]. Notifying Client[1] about Server[pid=37012].`). The form depends on the parent's `initialize`:
  - `supportsStartDebuggingRequest: true` → a `startDebugging` reverse request: `{"request": "attach", "configuration": {…}}`.
  - absent or `false` (debugpy's default, and what the worker sends today — `src/proxy/dap-proxy-connection-manager.ts` never advertises it) → a `debugpyAttach` event whose body is the same configuration plus `"request": "attach"`.
- The configuration, measured verbatim: the parent's launch arguments (`type`, `program`, `cwd`, `console`, `redirectOutput`, `showReturnValue`, `justMyCode`, `stopOnEntry`, `subProcess`, `python: [<interpreter>]`) minus `request` and `args` (the adapter also strips `processId`, `listen`, `preLaunchTask`, `postDebugTask`, `restart`, `processName`, `pythonArgs`, `host`, `port`), plus `name: "Subprocess <pid>"`, `subProcessId: <pid>` and `connect: { host: "127.0.0.1", port: <the adapter's own --port> }`. **`program` and `cwd` still name the parent's program** — the child's script is not in the report; it is only knowable from the process table or from the child's own first stop.
- Timing: `Popen` → report 238–379 ms across 14 runs (the parent's "spawned child" line to the request/event). The launch's own `initialized` arrives 630–980 ms after `launch` (interpreter start); the parent's `process` event comes with the launch response.
- `multiprocessing.Process` (spawn start method): the same report, 238 ms after `p.start()`; the child stops at `work@mp_parent.py:10` with `<module>@<string>:1` as the frame below it.
- Grandchildren are reported on the connection of the process that spawned them — the child's session's client (`startDebugging` on the child connection, same `connect.port`), never on the parent's. Each level gets the request form only if its own `initialize` advertised `supportsStartDebuggingRequest`.

## What a second connection needs

On a new TCP connection to `connect.host:connect.port` (the adapter port the parent already uses):

1. `initialize` (same arguments as the parent's; `supportsStartDebuggingRequest: true` if that level's children should arrive as requests).
2. `attach` with the configuration as delivered. The response comes only after `configurationDone`.
3. `debugpyWaitingForServer` (adapter server host/port) then `initialized`, 25–45 ms after `attach` was sent.
4. `setBreakpoints` — verified `true` immediately (`[[10, true]]`); then `configurationDone`.
5. The `attach` response (`success: true`) and the child's `process` event (`startMethod: "attach"`, `systemProcessId`) within 3 ms of each other; the child's first user line ran ~75 ms later, and a breakpoint on its first statement stopped it 70–90 ms after the response. Report → first stop ≈ 110 ms.
6. `threads` → `[{ id: 1, name: "MainThread" }]` — thread ids are per session (parent, child and grandchild all report `1`); `stackTrace` and `evaluate` behave as on any session.

What does **not** carry over from the parent session:

- **Breakpoints.** A breakpoint on `child.py` set through the parent's connection is verified on the parent (`[[10, true]]`) and never stops the child (measured: the child ran through). Each child needs its own `setBreakpoints`.
- **`stopOnEntry`.** `stopOnEntry: true` in the child's `attach`: no stop; the child runs to its end. The hold until `configurationDone` is the window in which breakpoints land before user code.
- **Output**, the other way round, arrives twice: with the delivered `redirectOutput: true`, every child stdout line is an `output` event on the **parent** connection (the launcher's captured pipe, which the child inherits) *and* on the child connection (pydevd's redirect). With `redirectOutput: false` in the child's `attach`: 0 output events on the child connection, the lines still on the parent's. So the design can pick per-process output (keep the redirect, drop the parent copy) or tree output on the parent (turn the redirect off) — the duplication is on the wire either way.

Two adapter facts that bound the worker's connection handling:

- The adapter serves many clients on its `--port`; the second and third connections were accepted without any flag.
- A client that connects and disconnects without a live session makes the adapter exit. A readiness probe that opens and closes a TCP connection before the real client (the driver's first version) left the real client's `initialize` unanswered and its socket closed, and the next connect was refused; the same happens after a client that sent only `initialize` disconnects. The adapter otherwise lives until the last client socket closes (`All debug sessions have ended; exiting.` at +28.7 s when the driver closed its sockets, the debuggees having ended at +5 s). The worker must close every connection it opened, as it does for the one today.

## What happens when the report is answered differently

- **Acked (`{}`) and never attached** — what the worker does today (`src/proxy/minimal-dap.ts` replies `{}` to unknown reverse requests): the child stays parked indefinitely. 4 s after the ack: not one child output line, process present. A late `attach` 4.8 s after the report adopted it normally (stopped at its first breakpoint 70 ms later). Adoption has no deadline on the adapter's side.
- **Rejected (`success: false`)**: the adapter unblocks the child itself (its source: `initialize` / `attach { subProcessId }` / `configurationDone` / `disconnect` on the server connection, "No clients to wait for - unblocking"). The child ran undebugged 100 ms after the rejection and the parent completed normally (exit 3). This is the Python release lever — no throwaway client connection needed, unlike js-debug ([spike-notes-forks.md](../javascript/spike-notes-forks.md)).
- **`debugpyAttach` event form**: nothing to answer; the child waits until a client attaches with its `subProcessId` (the acked-not-attached shape). Adoption from the event body behaved exactly as from the request.

## Cascade matrix

| | what was done | parent connection | child connection | processes afterwards |
|---|---|---|---|---|
| 1 | child exits while the parent is paused (parent at a breakpoint right after `Popen`; child adopted while the parent is paused — the report arrives regardless of the parent's state) | nothing until `continue` (its `threads` still answers); after `continue` the parent sees the child's exit code, then `exited(3)`, `terminated` | `thread exited`, `terminated` — **no `exited` event**: an attach session carries no exit code; socket left open | child gone, parent alive and paused |
| 2 | parent exits with the child live (`sys.exit(0)` 10 ms after `Popen`; child adopted and paused at its breakpoint) | **no `exited`/`terminated` for 20 s** although the parent process was gone (process table at +22 s: adapter + launcher, child alive). Launcher log: `Debuggee[PID=40104] exited with code 0` at +1.4 s, then `Waiting for remaining stdout of Debuggee[PID=40104]` until +29.1 s — the child inherited the parent's stdout pipe and the launcher waits for its EOF (the #993 mechanism). When the child ended: `exited(0)`, `terminated` | stayed debuggable throughout (`threads`, `continue` after the parent's death); `terminated` when it ended | child alive and paused until continued; nothing killed it — the adapter's "kill remaining debuggee processes" runs at session finalize, which the pipe wait delays |
| 3 | `disconnect { terminateDebuggee: false }` on the child alone (paused) | the parent later sees the child's exit 3 and ends normally | response `success`, `terminated`, socket closed by the adapter | child resumed and ran undebugged to its end |
| 4 | `disconnect { terminateDebuggee: true }` on the child alone (paused) | the parent sees child exit **0** 520 ms later (pydevd exits the process with code 0), then `exited(0)` | as row 3 | child gone |
| 5 | `terminate` on the parent (child paused) | response `success`; `exited(0)` + `terminated` within 10 ms (exit code 0 for the terminated process) | `terminated` within 5 ms | both gone within 1 s; both sockets left open |
| 6 | `disconnect { terminateDebuggee: true }` on the parent (child paused) — today's `close_debug_session` | as row 5, and the adapter closes the parent's socket | `terminated`; socket left open until the client closes it | both gone; adapter log: `"launch" session ended - killing remaining debuggee processes.` |
| 7 | grandchildren (child spawns `grandchild.py` after its loop) | `exited(3)` carries only the parent's own code | the grandchild's report arrives on the **child** connection 5.3 s in (when it was spawned); adopted, stopped, continued on its own connection; `terminated` cascades bottom-up (grandchild, child, parent) as each process ends | all gone at the end |

## Facts the design takes from this

1. Advertise `supportsStartDebuggingRequest: true` in the worker's `initialize` for Python: the request form carries the same payload as the event and adds the release lever (reject = child runs undebugged, 100 ms). Today's `{}` ack is the "park forever" answer that #1005 opened with.
2. One adapter per tree, N client connections to its port; a child session is `initialize → attach(config) → initialized → setBreakpoints → configurationDone` on a fresh connection, ~110 ms from report to first stop. No second adapter process, no new port.
3. Name the child by `subProcessId`; the delivered `program`/`cwd` are the parent's.
4. Re-send breakpoints per child; `stopOnEntry` is a no-op on attach; the pre-`configurationDone` hold is where they bind.
5. Output: decide per-process (`redirectOutput` on, dedupe the parent copy) or per-tree (`redirectOutput: false` on the child); both are one key in the child's `attach`.
6. Lifetime: a child is an attach session — `terminated` without `exited`; a child that inherits the parent's stdout delays the parent's `exited` until the child ends; `disconnect(terminateDebuggee: true)` on the parent ends the tree, on a child ends only that child (exit code 0).
7. Close every connection the worker opens: the adapter lives while any client socket is open and exits when a session-less client disconnects.
