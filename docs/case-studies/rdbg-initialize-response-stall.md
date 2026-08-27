# Case study: the initialize response that never came

*How mcp-debugger was used to debug itself — root-causing a 30-second Ruby launch stall. Issues [#492](https://github.com/debugmcp/mcp-debugger/issues/492) and [#493](https://github.com/debugmcp/mcp-debugger/issues/493), fixed in [#507](https://github.com/debugmcp/mcp-debugger/pull/507) and [#509](https://github.com/debugmcp/mcp-debugger/pull/509).*

## The incident

During a full 48-combination server×language sweep, three Ruby launches failed with:

> `Debug proxy initialization did not complete within 30s. This may indicate that the debug adapter failed to start or is not properly configured. Check that the required debug adapter is installed and accessible.`

Every immediate retry succeeded. The per-session proxy log for one failure (`proxy-9778df52-…`, complete, nothing elided):

```
14:22:03.818  [AdapterManager] Spawned adapter process PID: 52875
14:22:04.323  [AdapterManager STDERR] DEBUGGER: Debugger can attach via TCP/IP (127.0.0.1:35685)
14:22:04.324  [ConnectionManager] Attempting DAP client connect (attempt 1/60) to 127.0.0.1:35685
14:22:04.327  [ConnectionManager] DAP client connected to adapter successfully.
14:22:04.328  [ConnectionManager] Sending DAP "initialize" request
14:22:04.331  [AdapterManager STDERR] DEBUGGER: Connected.
14:22:04.362  [Worker] DAP "initialized" event received but deferred until after launch/attach
                       ← 29.4 s of total silence
14:22:33.793  [Worker] handleCommand cmd=terminate
```

Everything the error message suggests is contradicted by the log above it: the adapter started, opened its socket, accepted the connection, and even emitted a DAP event. One frame is missing: the **response** to the `initialize` request. The `initialized` **event** — which rdbg only emits while processing that very request — arrived 34ms later and decoded fine.

Issue [#470](https://github.com/debugmcp/mcp-debugger/issues/470) had previously fixed a frame-decoder bug with the same 30s signature, so the first question was whether this was a recurrence. It wasn't: all three of the decoder's loss paths log loudly since #470 (resync warnings, header-decode errors naming pending request seqs, unknown-request warnings), and none of those lines appear. The frame never reached the client.

## Debugging the debugger with the debugger

The stall lives in mcp-debugger's own proxy stack, which is TypeScript running on Node — so mcp-debugger's JavaScript adapter can step through it. A ~100-line replay was enough: a fake rdbg (a TCP server that reads the `initialize` request and sends back *only* the `initialized` event) plus a driver that runs the **real compiled `MinimalDapClient`** from `dist/` through the worker's exact launch sequence.

Then mcp-debugger debugged the replay:

```
create_debug_session { language: "javascript", name: "self-rca-492" }
set_breakpoint { file: "dist/proxy/minimal-dap.js", statement: "this.pendingRequests.set(requestSeq, {" }
set_breakpoint { file: "dist/proxy/minimal-dap.js", statement: "const pending = this.pendingRequests.get(response.request_seq);" }
set_breakpoint { file: "repro-492.mjs", statement: "initializedEventResolver();" }
start_debugging { scriptPath: "repro-492.mjs" }
```

(No line numbers: `statement` addressing binds breakpoints by content, which works even in a compiled `dist/` tree you don't want to count lines in.)

**Stop 1** — inside `MinimalDapClient.sendRequest`, registering the doomed request, with the driver's `await` (the same shape as the worker's initialize step) parked two frames up:

```
evaluate_expression → { command: "initialize", requestSeq: 1, pendingBeforeSet: [] }
```

The pending-request entry stores `resolve/reject/timer` — and, at the time, **no command name**, which is why the eventual timeout couldn't say *what* timed out. That observation became #493.

**Stop 2** — the `initialized` event mid-delivery. The stack is the whole causal chain: TCP data → `handleData` → `handleProtocolMessage` (the *event* branch — the breakpoint on the *response* branch never fired) → EventEmitter → the worker's deferred-initialized handler. Evaluated in the client's frame at that instant:

```
evaluate_expression → { eventBeingDelivered: "initialized", pendingRequestSeqs: [1] }
```

The adapter is alive and talking; the request it is answering-by-side-effect is still pending; and nothing in the launch path awaits the event at that point — the worker's `initializedEventPromise` is armed for the post-launch configuration flow, not for initialization. Released from the breakpoints, the replay documents the endgame, with `DAP_TRACE=1` recording the socket boundary:

```
{"ts":"…","direction":"out","payload":{"seq":1,"type":"request","command":"initialize",…}}
{"ts":"…","direction":"in","payload":{"type":"event","event":"initialized","seq":1}}
```

Two frames, then 30 seconds of nothing, then `DAP request 'initialize' (seq 1) timed out`. In production the parent's 30s deadline fires first and prints the misleading "not properly configured" message.

The client-side mechanism was now proven: **rdbg's `initialize` response never arrives; the worker awaits it unconditionally; the `initialized` event that proves the adapter is healthy resolves a promise nothing is awaiting.**

## What happened inside rdbg?

The debug gem's DAP handshake (`server_dap.rb`, debug 1.11.0) sends, in one thread, back-to-back:

1. `send_response(req, …)` — the initialize response
2. `send_event 'initialized'`
3. `puts <<~WELCOME…` — which becomes DAP `output` events via `UI_DAP#puts`

All three go through `send`, whose first line is a silent-drop guard:

```ruby
def send **kw
  if sock = @sock          # ← nil at this instant? the frame silently vanishes
    kw[:seq] = @seq += 1
    …
```

and `@sock`'s lifecycle is not fully synchronized — `cleanup_reader` closes and nils it *outside* the `@accept_m` mutex that guards accept/greeting. A frame can be skipped with no error anywhere.

What isn't yet proven is the exact interleaving: in the failing session the rdbg process was fresh and the sends are microseconds apart on one thread, so a simple nil-window doesn't obviously explain "response missing, event delivered." rdbg assigns `seq` in send order, which gives a clean discriminator for the next live capture:

- event arrives with **seq 1** → the response send was *skipped* server-side
- event arrives with **seq 2** → the response was *generated* and lost between rdbg's `sock.write` and the client's decoder

A 40-cycle live hunt (real rdbg, `DAP_TRACE=1`) reproduced nothing — consistent with the observed 3-in-48 intermittency under sweep concurrency. That's fine: the recovery below turns the next natural occurrence from a failure into a logged warning, and `DAP_TRACE=1` stays available to capture the seq when it happens.

## The fixes

**[#492](https://github.com/debugmcp/mcp-debugger/issues/492) — recover instead of dying** ([#507](https://github.com/debugmcp/mcp-debugger/pull/507)). The DAP contract makes the `initialized` event strictly follow successful `initialize` processing, so the event is proof the request was served even when the response frame is gone — and a dropped response will *never* arrive (DAP has no resend). Ruby launch initialization now races the response against the already-armed `initialized` event plus a 2-second grace period. If the event wins, a warning names exactly what happened and the launch proceeds with unknown capabilities (a documented-legal value every consumer already guards; a late response still captures them). Attach sessions and all other adapters keep the strict await. Verified end-to-end against a response-dropping fake rdbg: `start_debugging` completes in ~4s (2s of that is the grace period) instead of failing at 30s.

**[#493](https://github.com/debugmcp/mcp-debugger/issues/493) — when we do time out, tell the truth** ([#509](https://github.com/debugmcp/mcp-debugger/pull/509)). The proxy worker now reports its initialization progress to the parent (adapter spawned + PID, DAP transport connected, which handshake request is in flight), and the 30s timeout message reflects how far initialization actually got — *"connected to the debug adapter, but the \"initialize\" request never received a response; the adapter process is running (PID …); this is an adapter-side protocol stall, not a missing install"* — with the structured facts (`initProgress`, `proxyLogPath`) in the failed `start_debugging` result's `data`. The install-hint wording survives only for the case it correctly describes: nothing ever connected.

## Takeaways

- **An event can prove liveness that a missing response denies.** Protocol recovery can key off collateral evidence — here, an event that only exists because the unanswered request was processed.
- **Error messages are hypotheses; test them against the evidence.** The old timeout text was written for "adapter never started" and was actively wrong for every later stage. Stage-aware errors cost one status message per stage.
- **A debugger that can debug itself shortens the loop enormously.** Statement breakpoints in the compiled `dist/` tree, `evaluate_expression` against private state (`pendingRequests`), and the stack of the event-delivery moment turned a 29-second silent log gap into a mechanism in four tool calls.
- **Say what you can't prove.** The rdbg-side interleaving is hypothesized, not demonstrated; the seq discriminator documents exactly what the next occurrence will settle.
