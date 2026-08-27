# Case study: the trace that couldn't name its socket — paying down the #513 observability debt

*The #513 root-cause session ([the pause that always succeeded](js-attach-pause-and-the-smart-stepper.md)) ended with three issues about the diagnostics themselves: a 12s worker poll that spammed every attach trace and closed with a false warning ([#520](https://github.com/debugmcp/mcp-debugger/issues/520)), a per-session proxy log that contained none of the routing decisions readers were sent to it for ([#519](https://github.com/debugmcp/mcp-debugger/issues/519)), and a DAP trace that couldn't say which socket carried a frame ([#518](https://github.com/debugmcp/mcp-debugger/issues/518)). This session prosecuted the cluster with a measure-fix-measure loop: one scripted js-attach scenario against the real server, run byte-for-byte identically before and after, with the diffs as the acceptance test.*

## Why these three are one bug from the reader's seat

Root-causing #513 hinged on one question: **which DAP connection carried the pause?** js-debug runs a parent session plus an adopted child session per target, and mcp-debugger's proxy speaks to both from one worker process. Every artifact that should have answered the question declined:

- The **DAP trace** interleaves all connections' frames with independent `seq` spaces and no origin field — two `initialize` requests, both `seq: 1`, byte-identical in shape (#518).
- The **per-session proxy log** — the file `docs/diagnostics.md` points at, and the one `proxyLogPath` in failure payloads names — held the worker's own lines but none from `MinimalDapClient` or `ChildSessionManager`, whose module loggers write to a per-pid file under the *project's* `logs/` directory that nothing documents (#519).
- What the trace did contain, dominating the attach window, was noise: ~120 identical `threads` request/response pairs from a worker-side poll that can never act on js attach, capped by a warning claiming no threads were ever discovered (#520).

## Baseline: making the tool testify (main @ f9b9019b)

Method: a ~150-line MCP Streamable HTTP driver (lifted from `scripts/k8s-smoke.mjs`'s client) against `DAP_TRACE=1 node dist/index.js http -p 3021 --log-level debug`, attaching a js session to an idle `node --inspect=9229 -e "setInterval(()=>{},1000)"`, waiting out the 12s window, then `pause` → `stack` → a deliberately failing `evaluate` → close. Same script, same target, both runs.

The baseline (session `2262bd0e`) reproduced all three filings exactly:

- **#520** — attach response at `17:53:20.613`; first worker `threads` poll 1ms later; the 111th and last at `17:53:32.613`; then
  `[Worker] ensureInitialStop: no threads discovered within timeout` — while all 111 responses carried `threads: [{"id": 0, "name": "Remote Process [0]"}]`. Threads were reported the whole time; the poll's `id > 0` guard just refuses js-debug's id-0 child thread, forever.
- **#519** — `grep -c MinimalDapClient proxy-<sessionId>.log` → **0**. The same grep against `logs/debug-mcp-server-16800.log` (the worker's pid, knowable only from the OS) → **905**, including every `Routing 'threads' to child session (hasActiveChild=…)` decision. And the failed `evaluate`'s response line: `{"command":"evaluate","seq":205,"type":"response"}` — no success flag, no error, in any log.
- **#518** — the only reason the trace's two seq-1 `initialize` requests were tellable apart was the accident that `initialize` carries a `clientID`. The `pause`/`threads` frames an RCA actually needs carry nothing.

## The fixes (PRs [#524](https://github.com/debugmcp/mcp-debugger/pull/524), [#525](https://github.com/debugmcp/mcp-debugger/pull/525), [#526](https://github.com/debugmcp/mcp-debugger/pull/526))

- **#520**: attach never runs the worker-side entry stop — the session manager's policy-aware post-attach pause owns that concern, behind a 20s thread-verify loop that tolerates id 0. Launch runs it only when `stopOnEntry` was requested. A threads report whose first id is 0 counts as *discovered* (poll stops, no pause, truthful log). One trap made the diff bigger than the issue: the `requiresInitialStop && (launch || attach)` gate also guards the post-command queue drain, so the launch/attach distinction moved into a helper and a test now pins that attach still drains.
- **#519**: `createLogger` gained an opt-in `redirectable` flag; the four proxy module loggers opt in; the worker calls a new `redirectProxyLoggers({file, level})` right after creating its session logger, adding the session file's shared transport (already in the path-keyed cache — one handle, one rotation counter) to each. Add-only: the per-pid file stays as the pre-init fallback and the unpipe-close hazard is never touched. Response lines now carry `success`/`request_seq`, plus the adapter's error text on failures.
- **#518**: `MinimalDapClientOptions.traceLabel`, default `parent`; `ChildSessionManager` labels adoptions `child:<targetId8>` and throwaway release connections `release:<targetId8>`; every trace record — truncation markers included — carries `conn`.

## After: the same scenario, re-measured

Identical script, identical target, branch with all three fixes (session `12142572`):

| Signal | Before | After |
|---|---|---|
| `threads` frames in the attach trace | 222 (111 futile polls) | **4** (the session manager's legitimate verify) |
| `ensureInitialStop` in the proxy log | false warning after 12s | one debug line: *skipped for attach (session manager owns the post-attach pause)* |
| `MinimalDapClient`/`ChildSessionManager` lines in the proxy log | 0 (905 in an undocumented per-pid file) | **520**, next to the worker's own lines |
| failed `evaluate` response line | `{command, seq, type}` | `{command, seq, type, success: false, request_seq: 11}` |
| trace records with `conn` | 0 of 348 | **129 of 129** — `parent`: 18, `child:7ad4d963`: 111 |

The #513 regression guards held in the same run: `pause_execution` on the attached idle server reported the session already paused (the post-attach pause had landed), and the stack was readable.

## What generalizes

1. **Diagnostics deserve the measure-fix-measure loop too.** The acceptance test for an observability fix is the artifact diff, not the unit suite — the suite passed before these fixes as well.
2. **A false log line is worse than no log line.** "No threads discovered" sent the #513 investigation to verify thread reporting that was working fine. The fix wasn't removing the message; it was making it unreachable except when true.
3. **Shared files need origin fields.** Any log/trace fan-in point that multiple producers write to (here: DAP clients with independent seq spaces) is ambiguous exactly when it matters — when producers disagree.
4. **A gate that guards two things can't be narrowed for one of them.** The attach exclusion looked like a one-line condition change; the queue drain sharing the gate is why it wasn't. The test pinning drain-on-attach is the durable part of that lesson.
