# Case study: the bug report that couldn't happen — auditing a filed issue by debugging the debugger

*Issue [#638](https://github.com/debugmcp/mcp-debugger/issues/638) claimed the step tools return `{"success": false, "message": "Stepped over", "state": "running"}` — a failure that announces success. The claim came from careful code reading, survived an adversarial verifier, and was wrong: that payload is unreachable. This is the story of how three probes — a live tool call, an in-process driver, and finally mcp-debugger stepping through its own dist — overturned the diagnosis, located the actual information loss two layers away, and turned a wrong bug report into a better fix than the one it asked for. The through-line: a breakpoint beats a code read, because code reading composes functions in your head, and heads skip wrappers.*

## The report

#638 was filed by a documentation truth pass — an effort that reads code specifically to pin down what tools actually return. It cited real lines. `ExecutionController.step()` really does return `{ success: false, error: 'Not paused', state }` when the program is running. The handler really did build

```ts
const response: Record<string, unknown> = {
  success: stepResult.success,
  message: `Stepped ${stepType}`,
  state: stepResult.state
};
```

without ever reading `stepResult.error`. Compose the two and you get the filed payload: the agent is told the step failed and, in the same breath, that it stepped. The issue even named the pattern correctly — the same silent-failure shape the project had been closing in #574, #585, and #596.

One hop of the call chain was missing, and it inverted the story.

## Probe one: just call the tool

The debugger was already connected over the dev proxy, so the cheapest test ran first — reproduce the payload for real. Launch `examples/python/pause_test.py` (an infinite sleep loop) with `stopOnEntry: false`, wait until the session is firmly `running`, call `step_over`:

```json
{"success": false, "error": "Not paused"}
```

Not the filed payload. No fabricated `"Stepped over"`, and the reason — the thing the issue said was discarded — is right there. `continue_execution` returned the identical envelope. So the handler code the issue quoted, with its never-reads-`error` response building, evidently wasn't the code producing this answer. Something else was.

That something is in `src/server.ts`. Every step facade method wrapped the controller:

```ts
public async stepOver(sessionId: string): Promise<DebugResult<StepResultData>> {
  this.validateSession(sessionId);
  const result = await this.sessionManager.stepOver(sessionId);
  if (!result.success) {
    throw new Error(result.error || 'Failed to step over');
  }
  return result;
}
```

The wrapper threw before the handler's response-building code ever saw a failed result. The handler's catch turned the thrown message into `failureResult(error.message)` → `{success: false, error: "Not paused"}`. The `success: stepResult.success` expression the issue built its payload from could never be `false`. Dead code, wearing the costume of the live path.

## Probe two: the handler in a jar

To pin the whole chain without the MCP transport in the way, a 20-line driver imported the real pieces from `dist/` — `DebugMcpServer` and the actual `stepTool` handler — and called the handler directly, exactly as the tools/call dispatch would. First lesson for free: a session that was never started doesn't even reach `Not paused`; it takes a typed-error path and returns

```json
{"success": false, "error": "MCP error -32600: Cannot step over: no active proxy for session <id>"}
```

— protocol plumbing leaked into an application payload (the typed session errors extend `McpError`, whose constructor bakes the prefix into `.message`; filed as [#647](https://github.com/debugmcp/mcp-debugger/issues/647)). The driver then grew an inner debug session: a real python launch of the sleep loop, so `stepTool` could be called against a genuinely RUNNING session. Standalone, it printed the same honest-but-thin envelope as probe one. *(Fixed since #647 landed: the envelope now reads `"error": "Cannot step over: no active proxy for session <id>"` — the prefixed quote above is what the run produced at the time.)*

## Probe three: watch the state die

The driver was then run *under* mcp-debugger — a `javascript` session debugging the server's own compiled `dist/`, which meant the debugger's js adapter was attached to a process that itself constructs a `DebugMcpServer`, forks a proxy worker, and launches debugpy. Two breakpoints, both set by statement content rather than line numbers:

- `dist/server.js`, statement `throw new Error(result.error || 'Failed to step over')`
- `dist/server/handlers/execution-tools.js`, statement `return failureResult(error.message)` — which matched two lines (the step catch and the continue catch), so `nearLine` disambiguated, and the response disclosed the multi-match in a warning.

The nested setup was the riskiest part of the plan. The outer js-debug injects its bootloader into every child the debuggee spawns (`NODE_OPTIONS: --require .../bootloader.js`), and the inner server's forked proxy worker got it too — the exact territory where attach-mode debugging of fork-heavy servers has wedged before (#501). It didn't wedge: the inner python session launched, hit RUNNING, and the outer session stopped clean on the first breakpoint. Launch-mode nesting works.

At the wrapper frame, one evaluate told the whole story:

```text
> JSON.stringify(result)
'{"success":false,"error":"Not paused","state":"running"}'
```

Everything the agent needs exists at this line — the verdict, the reason, the state that explains the reason. The next line throws `new Error(result.error)`: a string survives, an object dies. Continue; the second breakpoint lands in the handler's catch:

```text
> ({ message: error.message, ownKeys: Object.keys(error), isPlainError: error.constructor.name })
{message: 'Not paused', ownKeys: Array(0), isPlainError: 'Error'}
```

Zero own properties. `state: "running"` is gone, destroyed in transit between two functions that both wanted to report it. The final envelope — same as probe one's live capture — is honest about the reason and silent about the state.

## What the issue got right, wrong, and useful

**Wrong:** the headline payload. It cannot occur; the "reassuring-but-wrong result" it warned about was already prevented by the wrapper's throw.

**Right, by accident:** that the failure envelope drops information. Just not the `error` field — the `state` field, plus everything else in the `DebugResult` (`canContinue`, `errorType`, `errorCode` — all destroyed by the same `new Error()`).

**Useful:** chasing the wrong claim surfaced three real defects nobody had filed: `continueExecution`'s facade collapsed its `DebugResult` to a `boolean`, making the handler's `'Failed to continue execution'` message dead code; the handler's `success: stepResult.success` was a latent trap waiting for anyone who removed the wrapper's throw without reading the handler; and the `MCP error -32600:` prefix leak (#647).

## The fix inverts the wrapper, not the handler

The repair ([#649](https://github.com/debugmcp/mcp-debugger/pull/649)) makes the facade return the controller's verdict as data — `stepOver/Into/Out` and `continueExecution` all hand the `DebugResult` through verbatim, and the handler builds the envelope: `{success: false, error, state}` on failure, wording plus `state` on success. This is precisely the shape `pause_execution` already had, because pause never went through the throwing wrapper — the asymmetry was the design telling on itself. A pleasant honesty dividend: a successful `continue_execution` now reports `state`, which is `"paused"` when a breakpoint fires before the continue acknowledgement resolves — previously unobservable.

After `dev_rebuild_and_restart`, the probe-one scenario returns:

```json
{"success": false, "error": "Not paused", "state": "running"}
```

— the payload that was always supposed to exist, produced by the path the issue thought it was reading.

## Takeaways

1. **A filed payload is a hypothesis until a tool call reproduces it.** This issue came from disciplined code reading *and* an adversarial verifier, cited real lines, and was still wrong — the failure mode of static analysis is omitting a hop, and every omitted hop can invert the conclusion.
2. **Debug the claim, not just the code.** The two-breakpoint session didn't just refute the payload; it produced the exact evidence — a live `result` object one line before its destruction — that made the right fix obvious and its PR description self-verifying.
3. **Statement-content breakpoints earn their keep in compiled output.** Nobody knows line numbers in `dist/`; `statement` plus `nearLine` landed both breakpoints on the first try, with the multi-match disclosed instead of silently guessed.
4. **`throw new Error(string)` at a data boundary is a data shredder.** If a result object crosses the boundary, pass the object. The codebase's own `pause` path was the working counterexample all along.
5. **Launch-mode self-debugging is safe territory.** mcp-debugger debugging its own server code — proxy fork, bootloader injection, and inner debugpy included — worked without drama, where attach-mode had history (#501). This is the first case study where the debugger refuted its own bug tracker.
