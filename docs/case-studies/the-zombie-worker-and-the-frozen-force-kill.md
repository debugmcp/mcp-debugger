# Case study: the zombie worker and the frozen force-kill

*How the stale-session reaper's leaked proxy worker ([#502](https://github.com/debugmcp/mcp-debugger/issues/502)) turned out to be a shutdown race the worker loses against itself — reproduced on the first try, then held open live by attaching mcp-debugger to **both sides of its own bug at once**: one debug session frozen inside the parent's force-kill timer, a second attached to the zombie worker it was about to kill.*

## The incident

Issue #502 (single Windows observation, low confidence): after the Streamable HTTP stale-session reaper tore down an abandoned session, that session's proxy worker process stayed alive for minutes, holding its DAP sockets, until killed by hand. A follow-up audit on the issue confirmed the teardown chain had real holes — fire-and-forget `stop()` calls behind cleared references, a `.killed`-gated SIGKILL escalation, no retained worker pid — but could not reproduce the leak on Linux: the reaper's own path tore down cleanly every time.

The audit was looking one layer too high. The live mechanism is in the worker.

## The race, precisely

On natural debuggee termination the worker's DAP event callback ends with a bare `this.shutdown()` — a floating promise (`dap-proxy-worker.ts`). `shutdown()` sets state `SHUTTING_DOWN`, then spends ≥1s in teardown (two 500ms grace waits plus an adapter tree-kill) before reaching `TERMINATED`.

Meanwhile the parent reacts to the same DAP `terminated` event by calling `ProxyManager.stop()`, which sends the worker an IPC `terminate` command. That command lands **inside** the shutdown window essentially every time — the parent's reaction takes ~7ms, the window is ~800ms. And then:

- `handleTerminate` sees `SHUTTING_DOWN` and **early-returns** ("Already shutting down or terminated.");
- the runner's sole exit scheduler runs after `handleCommand` returns and fires only when state is exactly `TERMINATED` — it sees `SHUTTING_DOWN` and schedules **nothing**;
- the in-flight shutdown later reaches `TERMINATED`, but it wasn't command-driven, so the check never runs again.

The worker completes its own shutdown perfectly and then sits alive forever in state `TERMINATED`, an idle event loop holding an IPC pipe. Nothing is coming to save it except the parent's 5-second force-kill timer — and the audit had already shown how that escalation can be skipped (`.killed` latches on any *delivered* signal, not on death; a second `stop()` no-ops because `cleanup()` already dropped the handle; the status-driven `'exit'` handler never stops at all). On Linux the SIGKILL usually lands, which is why the reaper path "worked". The leak is what happens when it doesn't.

First repro attempt, unfixed main, mock adapter, natural termination — the worker's own log:

```
21:44:15.058  [Worker] DAP event: terminated             ← floating shutdown() begins
21:44:15.065  [Worker] handleCommand cmd=terminate       ← parent's command, 7ms later
21:44:15.065  [Worker] Already shutting down or terminated.
21:44:15.065  [Worker] Completed command terminate … state=shutting_down   ← no exit scheduled
21:44:15.866  [Worker] Shutdown sequence completed.      ← TERMINATED; nobody re-checks
21:44:20.064  [ProxyManager] Timeout waiting for proxy exit. Force killing.  ← parent server log
```

The worker survived its own completed shutdown by exactly five seconds, and died only by SIGKILL. Deterministic, first try.

## Holding the bug open: two debuggers on one leak

A 5-second zombie is hard to inspect. So the window was held open with mcp-debugger itself:

1. **Target**: a standalone unfixed server, `node --inspect=9250 dist/index.js http -p 3987`.
2. **Debugger session 1** attached to the *server* (`attach_to_process`, port 9250) and set a breakpoint on the force-kill line — `set_breakpoint` echoed the exact line content back for verification:
   `` this.logger.warn(`[ProxyManager] Timeout waiting for proxy exit. Force killing.`) ``
3. A scratch MCP client drove a mock session to natural termination and abandoned it.
4. Five seconds later the server froze at the breakpoint — **inside the force-kill timer callback, SIGKILL not yet delivered**. Pausing the parent freezes its timer, so the window the race opened now stays open indefinitely.

The paused frame's async stack drew the whole indictment in one screen: the timeout callback → `stop()` → `handleExited` (`session-manager-core.ts` — the fire-and-forget site from the audit) → `handleDapEvent` → the IPC message handler. `evaluate_expression` in the frozen frame:

```json
{"handleKilled": false, "handleExitCode": null, "handleSignalCode": null,
 "workerPid": 672121, "managerProxyProcess": "nulled-by-cleanup", "isStopped": true}
```

The worker got its terminate command five seconds ago and has not exited (`exitCode`/`signalCode` null); the manager already nulled its own handle (`cleanup()` runs *before* the escalation) — only this closure can still kill it.

5. **Debugger session 2**, while session 1 held the parent frozen: `kill -USR1 672121` opened the zombie's inspector, and a second mcp-debugger javascript session attached straight to the leaked worker:

```json
{"pid": 672121,
 "argv": ["--mcp-owner-pid=671384", "--mcp-session-id=f0d62c51-…"],
 "uptimeSec": 54, "activeHandles": ["Pipe", "Socket", "Socket"],
 "connectedToParent": true}
```

A 54-second-old zombie (its debuggee died at t≈4s), argv-tagged as exactly the reaped session's worker, event loop empty but for the IPC pipe and stdio — alive until someone external kills it. That is #502's Windows observation, recreated and inspected from the inside on Linux.

6. `continue_execution` on session 1 released the frozen timer; SIGKILL delivered; the zombie died within a second. Both attach sessions closed cleanly.

## The fix ([PR #535](https://github.com/debugmcp/mcp-debugger/pull/535))

Root cause plus every hole the audit found on the escalation path:

- **Worker** (`dap-proxy-worker.ts`): `shutdown()` is now re-entrant via a latched promise; a `terminate` command arriving mid-shutdown **awaits the in-flight shutdown** instead of early-returning, so `handleCommand` completes only once state is `TERMINATED` and the runner schedules the exit. (A subtlety: the init-failure path shuts down *before* rethrowing, then used to roll state back and re-run the entire teardown to land on `TERMINATED` — the rollback is now skipped when a shutdown already ran.)
- **ProxyManager / process adapter**: the IPC-send, SIGKILL, and early-resolve guards in `stop()` now key on actual exit evidence (`exitCode`/`signalCode`), not `.killed`; `ProxyProcessAdapter.kill()` likewise refuses only after real exit, so escalation signals always deliver; the worker pid is retained across `cleanup()` and exposed as `IProxyManager.getProxyPid()`.
- **SessionManager**: terminal handlers record the pid and retain their `stop()` promise on the session (`pendingProxyStop`); `closeSession` awaits it even when `proxyManager` is already cleared; the status-driven `'exit'` (worker *claims* dead — the OS process may not be) now stops the proxy like every other terminal event; and 1.5s after every close a `process.kill(pid, 0)` liveness probe logs `leaked worker (issue #502)` with the pid if the worker survived — a recurrence can never again be invisible.
- **HTTP layer**: `MCP_HTTP_STALE_SWEEP_INTERVAL_MS` makes the 60s sweep testable in seconds; and `--log-file` now applies to the CLI logger too (see below).

After the fix, the same scenario:

```
22:05:10.748  [Worker] handleCommand cmd=terminate
22:05:10.750  [Worker] Terminate received during in-flight shutdown; awaiting completion.
22:05:11.549  [Worker] Shutdown sequence completed.
22:05:11.549  [Worker] Completed command terminate … state=terminated   ← exit scheduled
22:05:11.550  (node:687009) WARNING: Exited the environment with code 0
```

Clean exit ~800ms after termination; no force-kill anywhere; the abandoned session reaped three seconds later. The new e2e (`tests/e2e/mcp-server-smoke-http-stale-reap.test.ts`) pins the whole chain against the real server: worker pid captured via argv tags, client dropped without DELETE, pid polled to death, and the log asserted to contain the reap line but **not** the force-kill line — red on unfixed main, green in 7s after the fix.

## What dogfooding surfaced along the way

- **`--log-file` never reached the CLI logger.** The `http` command silences the console to protect stdio transports, and the CLI logger is created before option parsing — so the stale-session reaper's warn line (added by #337 precisely to make reaping visible) went to a per-pid default log nobody watches, and the operator's `--log-file` showed a session being closed with no explanation. Found because the e2e's reap assertion failed against a server that had demonstrably reaped. Fixed for `http` in this PR (`attachSharedFileTransport`); the deprecated `sse` path has the same defect ([#533](https://github.com/debugmcp/mcp-debugger/issues/533)).
- **Freezing a timer with a breakpoint is a general technique** for turning a transient process state into an inspectable one: the parent's 5s force-kill only fires from its event loop, so pausing the parent at the timer callback holds the child's zombie state open indefinitely — long enough to SIGUSR1 the child and attach a second debugger to it.
- **`set_breakpoint`'s content echo and the attach-mode refusal of `statement` addressing** both did their jobs: the echo confirmed the force-kill line before the run, and the refusal ("the debuggee's loaded source may not match the file on the mcp-debugger host") pushed toward line addressing with a clear reason rather than a silent mis-bind.
- **Worker stderr is logged at `error` level.** The parent forwards every worker stderr line as `[ProxyManager STDERR]` at error level — including the worker's own `[DEBUG]` diagnostics, which makes error-grepping a debug-level server log noisy ([#534](https://github.com/debugmcp/mcp-debugger/issues/534)).
