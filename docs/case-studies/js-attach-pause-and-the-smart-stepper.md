# Case study: the pause that always succeeded — js-debug's smart-stepper vs an idle server

*How `pause_execution` on a js attach session could return success forever without ever pausing anything ([#513](https://github.com/debugmcp/mcp-debugger/issues/513)), why the "obvious" root cause from code reading was real but wasn't the one in the field, and how the fix's own e2e test caught a third bug that interactive repro timing had masked. Continues the self-attach dogfooding line of [the fork-release/ack-window case study](self-attach-fork-release-and-the-500ms-ack-window.md), which filed #513 as its open side finding.*

## The incident

Attach a **javascript** session to an idle Node server (`node --inspect … dist/index.js http` — mcp-debugger itself, as usual), call `pause_execution`, and you get the documented soft answer:

```json
{"success": true, "state": "running", "data": {"pending": true,
 "message": "Pause requested; no 'stopped' event within 5s … The session will report 'paused' once the stop lands."}}
```

The contract says the stop lands the next time the program runs JavaScript. Then you curl the server's `/health` five times — it answers five times, so JavaScript provably ran — and the session stays `running`. Forever. Retried minutes apart: same. The prior dogfooding session lost an instrumentation window to this and worked around it with a breakpoint on a hot line (which stops instantly — remember that asymmetry; it becomes the tell).

## Hypothesis one: the routing hole (real, but not it)

Code exploration produced a beautiful, complete, *wrong-for-this-repro* mechanism. js-debug runs a parent ("root") session plus an adopted child session for the actual target, and mcp-debugger routes debuggee-scoped commands to the child. But when no child is available, `MinimalDapClient.sendRequest` logs a warning and forwards the command to the **parent** socket — and the vendored js-debug root handles these as:

```js
o.on("threads", async () => ({threads: []})),
o.on("pause",   async () => ({})),        // success. does nothing.
```

A pause that falls through to the root *succeeds silently and can never stop anything*. Everything fit: `stopOnEntry:false` attach returns before adoption, `threads` discovery returning `[]` explains threadId 0, and only `stackTrace` had a wait-for-child guard.

Then the first live repro (server logs at info) demolished it as the operative mechanism: adoption **had** happened 200ms after attach, and the pause **was** dispatched to the child — `Routing 'pause' to child session (hasActiveChild=true)`. The hole is real (it became fix layer 3), but the field failure lived somewhere else.

Two things in that first log pointed onward:

1. `grep -c stopped` → **0**. The child accepted the pause and no stop ever happened.
2. **512 `continued` events**, `{threadId: 0, allThreadsContinued: false}`, at a metronomic ~43ms — starting the instant the first `/health` request ran and continuing for 22 seconds after the curls stopped.

Something was resuming the target over and over. Nothing in mcp-debugger sends resumes.

## The adapter testifies against itself

Instead of reconstructing CDP behavior from our side of the wire, the adapter was made to narrate: js-debug honors `trace: true` in the attach config, and `attach_to_process` forwards `adapterConfig` keys — so one tool call produced `/tmp/vscode-debugadapter-*.json` with every DAP **and** CDP frame and their timestamps. The smoking gun, verbatim:

```
dap.receive  {command: "pause", arguments: {threadId: 0}}
cdp.send     {method: "Debugger.pause"}
dap.send     {command: "pause", success: true}
… idle until the first HTTP request runs JS …
cdp.receive  {method: "Debugger.paused",  reason: "other", top: ["emitInitNative", ""]}   ← the pause LANDED
cdp.receive  {method: "Debugger.resumed"}                                                 ← and was thrown away
cdp.receive  {method: "Debugger.paused",  reason: "step",  top: ["emitInitNative", ""]}   ← converted into a step
cdp.receive  {method: "Debugger.resumed"}
cdp.receive  {method: "Debugger.paused",  reason: "step",  top: ["lookupPublicResource", ""]}
…443 more, one CDP round-trip (~43ms) apart…
```

The pause worked. V8 paused at the very next statement — an internal frame with an empty script URL. js-debug looked at that frame, decided it wasn't worth showing, and issued a **step** instead of a stop. The step landed on another internal frame. Repeat.

The vendored bundle names the mechanism precisely (`getSmartStepDirection`, de-minified):

```js
var exempt = new Set(["breakpoint", "exception", "entry"]);   // note what's missing
async getSmartStepDirection(pausedDetails, expectedPauseReason) {
  if (!this.launchConfig.smartStep || exempt.has(pausedDetails.reason)) return;
  const frame = …top stack frame…;
  if (await frameScore(frame) === 0) return;        // frame is presentable → really stop
  return this._smartStepCount++ > 256 ? /*stepOut*/ 2
       : expectedPauseReason?.reason === "step" ? expectedPauseReason.direction
       : /*stepInto*/ 0;
}
```

Three facts assemble the failure:

- **A user pause is not exempt.** Breakpoint, exception, and entry stops are; `pause` smart-steps like any step would.
- **On a mostly-idle server, every frame the pause can land on is skip-worthy** — the only JavaScript that runs between requests is node-internals (blackboxed by the default `skipFiles: ["<node_internals>/**"]`) and frames with no URL. The stepper never finds a frame it deigns to show.
- **The >256-step failsafe makes it worse, not better**: it switches to step-*out* — and stepping out of an idle event loop's callback just parks you in the next internal callback. The 512-event flood is the failsafe running forever at one CDP round-trip per step.

This also explains the workaround asymmetry that had been sitting in the issue all along: breakpoints are in the exempt set. `set_breakpoint` + curl always stopped instantly *because* it bypassed the stepper the pause was dying in.

And `launchConfig.smartStep` defaults to `true`; mcp-debugger's **launch** transform sets it explicitly, its **attach** transform never mentioned it.

## One-line disproof-or-proof

Before writing any fix: the hypothesis predicts `adapterConfig: {smartStep: false}` cures it. Live, against the same idle server:

```
attach_to_process {port: 9339, stopOnEntry: false, adapterConfig: {smartStep: false}}
pause_execution → {"success": true, "state": "paused",
                   "data": {"stopReason": "pause",
                            "location": {"file": "<node_internals>/internal/timers", "line": 507}}}
```

Not even `pending` — a stray timer gave the pause something to land on within the 5s grace. Stack trace, `evaluate_expression` in the live server, continue: all working. That paused-at-an-internal-frame result is exactly what an IDE shows when you pause an idle server, and it is *true*.

## The fix, in three layers

([PR #522](https://github.com/debugmcp/mcp-debugger/pull/522)) — each layer earns its place against a different way the same symptom regrows:

1. **`smartStep: false` by default on js attach** (caller value wins; launch unchanged; breakpoint/exception/entry stops never consulted the stepper anyway). This is the field fix: pausing an attached process must land truthfully, even on an unglamorous frame.
2. **Child-required commands wait for adoption to *complete*.** New policy vocabulary (`childRequiredCommands: {'pause'}`, `ChildSessionManager.getChildTargetState()`): a pause dispatched while the child target state is `adopting` now waits (bounded) for `active` — see bug three below for why "an activeChild reference exists" was not the right readiness test.
3. **No silent parent fallback, ever, for a command the parent is known to no-op.** When no child can appear (`none` after a grace, or `ended` after the child died — including dying mid-dispatch), `pause_execution` returns a structured `{success: false, error: "Cannot deliver 'pause': no debug target …"}` instead of the forever-`pending` success. `threads` deliberately keeps its parent fallback: the attach verify loop depends on polling it before the child exists.

Plus the contract text: the tool description now names the failure mode.

## Bug three: found by the regression test, not the investigation

The new e2e attaches to a **truly idle** fixture (an HTTP server with no timers — `attach_target.js` ticks every 100ms and can't repro any of this), pauses, then hits `/work`. First run: **fail**. The pause neither landed nor errored, and this time the DAP trace showed the pause request receiving *no response at all* — sent 45ms before the child's own `attach {__pendingTargetId}` went out. A request written to the child connection after it connects but before it binds to its pending target is simply swallowed by js-debug.

Interactive repro could never see this: two MCP tool calls are seconds apart, and adoption takes ~200ms. The e2e's back-to-back calls hit the window every time. Layer 2 originally waited for the `activeChild` reference (set at socket-connect); it now waits for the adoption state machine to report `active` (set after the child's attach handshake). The final e2e run also validated the `pending` contract end-to-end — including the pleasing detail that the `/work` request itself never gets a response, because the pause fires *mid-request*, which is precisely what it's for.

## Side findings, filed

- **DAP trace has no parent/child discriminator** — parent and child frames interleave in one file with independent `seq` spaces; "which socket carried this pause" needed timestamp-joins against a second log ([#518](https://github.com/debugmcp/mcp-debugger/issues/518)).
- **The routing layer's logs never reach the per-session proxy log** — `MinimalDapClient`/`ChildSessionManager` log to a per-pid file under `logs/` that nothing points to; `proxy-<sessionId>.log` shows only `[Worker]` lines, and DAP responses are logged without their `success` flag ([#519](https://github.com/debugmcp/mcp-debugger/issues/519)).
- **`ensureInitialStop` burns 12s of `threads` polling on every js attach** — the child's thread id is 0, the guard wants `> 0`, and the "no threads discovered" warning it ends with is false ([#520](https://github.com/debugmcp/mcp-debugger/issues/520)).

## Takeaways

1. **A mechanism that explains everything still has to be caught doing it.** The routing hole predicted every symptom and was real code — and the very first live log falsified it as the cause. The fix kept it as a layer, but the field bug was three abstraction levels away, inside the adapter.
2. **Make the adapter narrate rather than reconstructing it.** `adapterConfig: {trace: true}` is one tool argument and yields the adapter's own CDP/DAP ledger with decisions visible. Hypothesis one to smoking gun took a day of log spelunking; smoking gun to verified fix took two tool calls.
3. **"Success" is five different claims for a pause**: request accepted ≠ CDP pause armed ≠ VM paused ≠ adapter chose to *report* the pause ≠ session state updated. #513 lived in gap four; bug three lived in gap two. Tool contracts should name which claim they make — the pending message now does.
4. **Repro timing is a test dimension.** Interactive tool calls are seconds apart; the e2e's are milliseconds apart. Each timing found a bug the other could not reach. Keep both.
5. **A flood of `continued` events with zero `stopped` is a signature**, not noise: something downstream is eating your stops. Grep for it before theorizing.
