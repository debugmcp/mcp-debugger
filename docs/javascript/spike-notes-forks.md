# js-debug child processes — spike notes (issue #1005, part B)

The measured facts behind the session-tree design for JavaScript: how js-debug reports a forked or spawned Node process, what a second DAP client needs to adopt it, and what each level's exit, `disconnect` and `terminate` do to the rest of the tree. Today the proxy adopts exactly one child per session and releases every other target to run undebugged (`ChildSessionManager`, #501); read [README.md](README.md) for that behaviour. This file is what the design in `docs/architecture/` will be built from; the Python half is [spike-notes-subprocess.md](../python/spike-notes-subprocess.md).

Measured 2026-11-03 on Windows 11 with the vendored js-debug v1.140.0 (`packages/adapter-javascript/vendor/js-debug/vsDebugServer.js <free port> 127.0.0.1`), Node v24.14.1, mcp-debugger at `06b5a15f`, with a **throwaway DAP driver** (not the proxy worker) opening one root connection plus one connection per adopted process to the same server, every frame logged per connection. The launch request is the adapter's shape (`type: "pwa-node"`, `console: "internalConsole"`, `outputCapture: "std"`, `skipFiles: ["<node_internals>/**"]`, `smartStep: true`, `sourceMaps: false`) with `autoAttachChildProcesses: true` explicit. Fixtures: `parent.js` starts `child.js` with `fork()` (default) or `spawn(process.execPath, …, { stdio: "inherit" })` and either waits for it or exits at once; `child.js` runs a five-tick `setInterval` (200 ms, or 1 s in the "long" shape) over one statement (the breakpoint line) and optionally `spawnSync`s `grandchild.js`. Times are wall-clock milliseconds from the driver's start on a loaded box; read them as orders of magnitude.

## Verdict

Go. Every process in the tree is one `startDebugging` with a `__pendingTargetId`, adopted on a new connection to the same server with today's child handshake — N times instead of once. The report arrives on the session of the process that spawned it, which is the parent link for free. The cascade differs from Python in two ways that matter: rejecting a report does not release the child, and only the root launch session's `disconnect` ends the tree.

## How js-debug reports a process

- The launched program is itself a child: the root (launch) connection gets `startDebugging {"request": "launch", "configuration": {"type": "pwa-node", "name": "parent.js [39984]", "__pendingTargetId": "<24 hex>"}}` 115–170 ms after the launch response — today's `launchWithPendingTarget`. The reverse request says `request: "launch"` even though the adoption is an `attach`.
- A `fork()` or `spawn(process.execPath, …)` under `autoAttachChildProcesses: true` (the bootloader rides the inherited `NODE_OPTIONS`; both shapes behaved identically) is reported 105–155 ms after the spawn — on the **main** connection (the session of the parent process), never on the root. A grandchild is reported on the fork's connection. The configuration is the same three keys; `name` is `<script> [<pid>]`, the only hint at what the process is.
- The reported process is parked in `waitForDebugger` until a connection attaches with its `__pendingTargetId`.
- Each debuggee process has a `vendor\js-debug\watchdog.js` Node child beside it (the bootloader's watchdog) — in a process-table view the tree is twice as wide as the program's.

## What a second connection needs

1. `initialize`.
2. `attach { type: "pwa-node", request: "attach", __pendingTargetId, continueOnAttach: true }` (`buildChildStartArgs` in `packages/shared/src/interfaces/adapter-policy-js.ts`). The response waits for `configurationDone`.
3. `initialized` 0–16 ms later.
4. `setBreakpoints` — answers `[[null, false]]` (unverified, no line): binding is deferred, a `breakpoint changed` event follows after the attach, and a breakpoint inside the child's first 200 ms timer tick stopped on that first tick, so it was live before user code ran.
5. `configurationDone`, then the `attach` response 19–40 ms after `attach` was sent; `thread started`, ~150 `loadedSource` events, `continued`; the child's first line ran 10–17 ms after the response.
6. `threads`: root `[]`; main `[{ id: 0, name: "parent.js [pid]" }]`; fork `[{ id: 1, name: "child.js [pid]" }]`; grandchild id 2 — thread ids are unique across the server's sessions (debugpy numbers them per session).

Variance seen once (`disconnect-main` run): the first event after adoption was `stopped` with reason `pause` at `child.js:1` rather than the breakpoint — the entry pause surfaced before `continueOnAttach` resumed. The proxy's entry-stop handling for the one child already covers that shape.

What does **not** carry over:

- **Breakpoints.** A breakpoint on `child.js` set through the main (parent process) session never stopped the fork (measured NO). Re-send per child, as `configureChild` does today.
- **Output** goes the other way: all stdout/stderr of the whole tree arrives as `output` events on the **root** connection only (forks inherit the parent's pipes, `outputCapture: "std"`); child sessions carry no `output` events at all. js-debug's own `Debugger attached.` / `Waiting for the debugger to disconnect...` stderr lines per process arrive the same way.
- **Exit.** No session ever sends DAP `exited`; each ends with `thread exited` + `terminated` when its process exits. Sockets stay open until the client closes them (the server exited when the driver's last socket closed).

## What happens when the report is answered differently

- **Acked (`{}`) and never attached**: parked — 4 s later no child output and the process alive. A late attach 4.9 s after the report adopted it normally (stopped on the breakpoint 240 ms later).
- **Rejected (`success: false`)**: the child stays parked **indefinitely** — 20 s with no progress, process alive, and the parent (waiting on its exit) never ends. js-debug has no unblock-on-reject; the throwaway attach-then-detach release (#501's lever, `src/proxy/throwaway-release.ts`) remains the only way to let an unadopted child run. The opposite of debugpy.

## Cascade matrix

| | what was done | root connection | main (parent process) connection | fork connection | processes afterwards |
|---|---|---|---|---|---|
| 1 | child exits while the parent is paused (parent at a breakpoint right after `fork`; the fork's report arrived 140 ms after the parent's stop — reporting does not need the parent running) | output of both | nothing until `continue` (`threads` still answers); after `continue` the parent sees exit 3, `terminated` | `terminated` when the child ended; socket left open | child gone, parent alive and paused |
| 2 | parent exits with the child live (`process.exit(0)` right after `fork`/`spawn`, child unref'd, 5 s child) | `terminated` 70 ms after main's | `thread exited` + `terminated` at the parent's exit | **the fork is never reported** | **the child process is gone by +300 ms** (both `fork` and `spawn` shapes). The launch owns the tree: the program's exit ends everything under it |
| 3 | `disconnect` on the fork alone (paused), `terminateDebuggee` false **or** true | — | the parent later sees exit 3 and ends normally | response `success`, `terminated`, socket closed by js-debug | the child kept running in both cases (done 4 s later). A session that adopted a pending target never kills it |
| 4 | `terminate` on main (fork paused) | nothing | `terminated` at once; **no response within 10 s** | nothing within 10 s | parent and paused child both alive 20 s later |
| 5 | `disconnect { terminateDebuggee: true }` on main (fork paused) | nothing | as row 4: `terminated`, no response | nothing | both alive 20 s later |
| 6 | `disconnect { terminateDebuggee: true }` on the **root** (fork paused) — today's `close_debug_session` path | **no response within 10 s**; socket left open | `terminated` ~600 ms later | `terminated` ~600 ms later | **both gone**. The root launch session is the only DAP lever that ends the tree; the worker's own tree-kill (`terminateDebuggee`-independent) stays necessary for the response that never comes |
| 7 | grandchildren (child `spawnSync`s `grandchild.js` after its loop) | output of all three | — | the grandchild's report arrives on the **fork** connection 5.2 s in; adopted and stopped on its own connection; `terminated` cascades bottom-up (grandchild, child, parent) as each exits | all gone at the end |

## Facts the design takes from this

1. Adopt N: today's handshake on a new connection per report; the connection that received the request names the parent (root → main → fork → grandchild), so `parentSessionId` falls out of routing. Nothing new is needed from js-debug.
2. Release stays the throwaway attach (#501); never answer a report with `success: false`.
3. Re-send breakpoints per child; there is no `exited`, only `terminated`; output is tree-wide on the root and must be attributed by the worker if per-child buffers are wanted (the `name` in the report carries the pid; so do the `Debugger attached.` lines' order, nothing else).
4. Ending: only the root's `disconnect` ends the tree, and it does not answer; `terminate`/`disconnect` on a program or child session leave processes alive. Keep the worker's timeout-then-tree-kill.
5. A child never outlives the launch: the program's exit kills unreported children within 300 ms, so an orphaned-child policy is not needed for js-debug (it is for Python, where a paused child outlives its parent).
