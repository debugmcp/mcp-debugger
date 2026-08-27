# Case study: attaching the debugger to itself — a fork release and a 500ms ack window

*How fixing "attach strands forked children" ([#501](https://github.com/debugmcp/mcp-debugger/issues/501), [PR #514](https://github.com/debugmcp/mcp-debugger/pull/514)) uncovered a second, older bug — a lost init acknowledgment ([#512](https://github.com/debugmcp/mcp-debugger/issues/512), [PR #515](https://github.com/debugmcp/mcp-debugger/pull/515)) — and how the second bug was root-caused by live-patching the debuggee through its own `evaluate_expression`, after strace made the race vanish.*

## The incident

Issue #501: attach a **javascript** debug session to a Node process that `fork()`s children, and the children wedge forever — their main module never runs. The flagship victim is mcp-debugger itself: attach to a live mcp-debugger server and every debug session it then tries to create fails with `Init not acknowledged, attempt N/6`, because its freshly forked proxy worker never executes.

Code exploration confirmed the hypothesized mechanism precisely:

- js-debug's pwa-node **attach** defaults inherit `autoAttachChildProcesses: true`, so attaching injects its NODE_OPTIONS bootloader into the inspected process (over CDP). Every subsequent `fork()` starts parked under `waitForDebugger`, and js-debug sends a `startDebugging` reverse request per fork.
- The policy acks the reverse request with success **before** the adoption decision (`adapter-policy-js.ts`), then `ChildSessionManager` — single-child by design — hits `adoptionInProgress || hasActiveChildren()` and silently drops it. Nobody ever opens the DAP connection carrying that `__pendingTargetId`, which is the **only** thing that unparks a pending target.
- Launch mode already sets `autoAttachChildProcesses: false`; attach mode never did.

## Fix one: don't park what you can't adopt

Two complementary levers ([PR #514](https://github.com/debugmcp/mcp-debugger/pull/514)):

1. **Default `autoAttachChildProcesses: false` on the js attach path** — mirroring launch mode, caller-overridable via `adapterConfig`, added to `supportedAttachKeys`. Forks of an attach target run untouched by default.
2. **Release instead of drop.** When a `startDebugging` target cannot be adopted, a throwaway `MinimalDapClient` performs the minimal unpark sequence verified against the vendored bundle — `initialize` → `configurationDone` → `attach {__pendingTargetId, continueOnAttach: true}` → grace for the ready signal → `disconnect {terminateDebuggee: false}` — so the child runs undebugged, with a loud warning.

The e2e proof drives a new fixture, `examples/javascript/fork_attach_target.js`, which forks a child every 2s and logs `child-handshake N` when the child's IPC announcement arrives — the same fork + init-ACK shape as ProxyManager's worker handshake.

One subtlety surfaced only in the real stack: with the bootloader opted back on, the per-fork `startDebugging` requests arrive **on the adopted child's DAP connection**, not the parent's — where the child-safe policy used to squash them ("no grandchildren"). The server log made this diagnosis trivial: 23 `startDebugging` requests received, 1 adoption, 0 releases. The child-safe policy now forwards unadoptable targets back to the manager for release.

A second subtlety never reached production but ate an hour of test debugging: `ChildSessionManager` dynamically imports `MinimalDapClient` (cycle-breaking), and a release racing an adoption issued two **concurrent** `import()` calls for the same module — which vitest's module mocker resolved inconsistently, handing the adoption the mock and the release the *real* class (`connect ECONNREFUSED` from inside a unit test). Caching the import promise at module scope fixed it; noted here because "same specifier, different module" is a genuinely disorienting failure shape.

## The validation that refused to pass

With #501 fixed, the flagship scenario should just work:

```
node --inspect=127.0.0.1:9339 dist/index.js http -p 3111        # subject
create_debug_session {language: javascript}                      # outer mcp-debugger
attach_to_process {port: 9339, stopOnEntry: false}               # attach OK, subject keeps serving
# then a plain MCP client asks the subject to start a debug session
```

Baseline (no debugger attached): the subject forks its proxy worker and completes a dry-run launch in ~700ms. Attached: **`Failed to initialize proxy after 6 attempts. Last error: Proxy process not available`** — but with a twist that ruled out #501's mechanism entirely. The worker's own log showed a *complete, successful* run: init received, dry-run executed, `State set to TERMINATED after message flush`, clean exit 0. The fork ran fine. Its **acknowledgment never counted**.

Manual retries then muddied the water: driving the subject seconds after attach failed; driving it a minute later succeeded. A scripted harness (attach → drive immediately → detach, N cycles) settled it: **0/6 clean with zero settle delay, 100% clean in steady state**. Something about a *fresh* js-debug attach — script enumeration, telemetry — briefly slows the subject.

## strace lies by observing

The obvious next step, `strace -f` on the subject to watch the IPC bytes, produced a perfect heisenbug: under ptrace the cycle **passed** (1/1 clean, just slower). The tracer's overhead re-ordered the race it was supposed to observe.

The debugger got out of the tar pit itself. Since the outer attach session can evaluate arbitrary expressions in the subject, it can *be* the tracer — with near-zero overhead and no restart:

1. Attach in the safe steady-state window; land an evaluation context by putting a breakpoint on the `/health` handler and curling it (`pause_execution` never landed on the idle server — filed as [#513](https://github.com/debugmcp/mcp-debugger/issues/513)).
2. `evaluate_expression` a monkeypatch: wrap `ChildProcess.prototype.emit` and `.send` to append every IPC event to `globalThis.__ipcTrace`.
3. Remove the breakpoint, continue, **detach** — the patch stays resident.
4. Reproduce: 3 failing cycles out of 4.
5. Re-attach, read `globalThis.__ipcTrace` back.

The trace was unambiguous. Every worker — failed cycles included — delivered `{"type":"status","status":"init_received"}` and `dry_run_complete` to the parent's ChildProcess:

| cycle | spawn → `init_received` | outcome |
|---|---|---|
| clean | 338 ms | acked inside attempt 1's window |
| clean | 427 ms | acked inside attempt 1's window |
| failed | 669 ms | ack arrived — and vanished |
| failed | 821 ms | ack arrived — and vanished |
| failed | 842 ms | ack arrived — and vanished |

The boundary between the two populations is exactly **500 ms**.

## Fix two: the ack that fell between the windows

`ProxyManager.sendInitWithRetry` registered its `init-received` listener per attempt and removed it when that attempt's window (500 ms first) expired. An ack arriving during the *inter-attempt backoff sleep* fired into a void. For a dry-run worker the sequence was then fatal: worker acks late → ack dropped → worker finishes and exits (as designed) → every remaining retry throws `Proxy process not available` → launch fails 16 s later, blaming a worker that did everything right.

Nothing here is specific to being inspected — a fresh js-debug attach is merely a reliable way to add ~300 ms to worker boot. Any loaded CI host could hit the same gap, which likely explains a family of flaky `Failed to initialize proxy` failures.

The fix ([PR #515](https://github.com/debugmcp/mcp-debugger/pull/515)): one latch listener spans the whole retry sequence; both the attempt window and the backoff end early the moment the ack arrives; a failed send skips the pointless wait; and once the worker has exited without acking, the loop fails fast with the detailed exit message instead of burning ~15 s against a dead process.

Integrated result: the 0/6 harness went **6/6 clean**, with failing-window launches completing in ~1 s (ack latched during backoff) instead of failing at 16 s. mcp-debugger can now attach to a live mcp-debugger server that keeps forking debuggable workers under inspection.

## Side findings

- **[#513](https://github.com/debugmcp/mcp-debugger/issues/513)** — js attach `pause_execution` stays `pending` forever on an idle Node server, even once JS provably runs. Workaround: breakpoint on a hot line.
- **[#502](https://github.com/debugmcp/mcp-debugger/issues/502) negative result** — the HTTP stale-session reaper scenario was re-run on Linux with a 5 s stale window: the abandoned session's worker and adapter were torn down cleanly (IPC terminate, exit 0). The code-level audit of paths that *could* skip the kill silently is in the issue comments.
- **One unexplained SIGKILL** — during the first attach of the session, the outer session's own proxy worker was SIGKILLed by an unknown sender ~54 s after attach (its vsDebugServer survived as an orphan the startup janitor won't reap while the owner lives). A system-wide bpftrace SIGKILL watch armed for the rest of the session — a dozen further attaches — never saw it again. Recorded here for the trail.

## Takeaways

1. **The debuggee can host its own tracer.** `evaluate_expression` + a resident monkeypatch beat strace exactly where strace failed: observation overhead was the difference between reproducing and hiding the race. Detach doesn't evict the patch — instrument once, reproduce freely, read back later.
2. **"The worker never ran" and "the worker's ack was dropped" present identically** at the tool-result level. The per-session proxy log (`proxyLogPath` in the failure payload) is what distinguished them in seconds.
3. **Retry loops need latches, not windows.** Any handshake retried with per-attempt listeners has a gap between the windows; the event that arrives in the gap is the one you can least afford to lose.
4. **Scripted repro harnesses turn "flaky" into "boundary".** Six manual trials produced folklore; a 30-line cycle script produced 0/6 vs 6/6 and a clean 500 ms threshold.
