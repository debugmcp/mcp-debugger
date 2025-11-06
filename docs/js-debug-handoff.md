# Handoff: Working js-debug Probe, DAP Behavior, and Next Steps

This document transfers the context and concrete steps to continue integrating a working JavaScript (js-debug) debugging flow into the MCP Debugger proxy. It captures the DAP handshake that is now verified to pause a JavaScript target at a breakpoint, aligns it with vsCode js-debug behavior, and outlines exact changes to port into the proxy.

## TL;DR

- We now have a working probe that reliably pauses a JavaScript script at a breakpoint using the vendored `js-debug` adapter.
- The winning approach uses:
  1) Parent session attach to a separately spawned Node target (`--inspect-brk`), followed by
  2) Child session adoption via `__pendingTargetId` using strict DAP ordering.
- This avoids DI ambiguity and race conditions that previously prevented us from ever seeing a `stopped` event.

You should port this handshake into the proxy (MinimalDapClient + DapProxyWorker), preserving sequencing and avoiding parent attaches by port after launch.

## What Changed

- New file: `scripts/experiments/js-debug-probe-attach.mjs`
  - A standalone DAP client that:
    - Spawns vendored js-debug (`vsDebugServer.cjs`) on a random TCP port
    - Spawns a Node target with `--inspect-brk=<freePort>`
    - Parent session: `initialize -> initialized -> setExceptionBreakpoints([]) -> setBreakpoints -> configurationDone -> attach` (by inspector port)
    - Handles reverse `startDebugging` with `__pendingTargetId` by creating a child session that:
      - `initialize -> initialized -> setExceptionBreakpoints -> setBreakpoints -> configurationDone -> attach { __pendingTargetId }`
    - Waits for a `stopped` event (reason breakpoint) and verifies stack/scopes/variables/evaluate
  - This script now consistently pauses at a breakpoint and can inspect variables.

- We previously iterated on `scripts/experiments/js-debug-probe.mjs`. While it helped us learn, the attach-only probe (`-attach.mjs`) is the validated path and easiest to port.

## Why This Works (Key Learnings)

- js-debug uses a multi-session model:
  - Parent launcher session (what we connect to first)
  - Child sessions created via reverse `startDebugging` with `__pendingTargetId`
- Parent attaches to the inspector port should be done only for the initial connection to the debuggee, then child adoption handles the actual program threads/UI. Attaching the parent again by port later can cause DI ambiguity and "Ambiguous match found for serviceIdentifier: je" errors.
- Strict DAP ordering is critical:
  - `initialize` (parent) -> wait `initialized`
  - send config requests (breakpoints, exception filters)
  - `configurationDone`
  - then `attach` (parent)
  - on reverse `startDebugging` with `__pendingTargetId`:
    - child `initialize` -> wait `initialized`
    - send child configuration (`setExceptionBreakpoints`, `setBreakpoints`)
    - `configurationDone` (child)
    - `attach { __pendingTargetId }` (child)
  - wait for `stopped`
- Fallbacks: if `stopped` isn't seen, do `threads` polling + `pause(threadId)` and then wait for `stopped`.

## Verified DAP Sequence (Parent + Child)

Parent session:
1) initialize
2) wait for initialized event
3) setExceptionBreakpoints { filters: [] }
4) setBreakpoints { source: { path }, breakpoints: [...] }
5) configurationDone
6) attach {
     type: 'pwa-node',
     request: 'attach',
     address: '127.0.0.1',
     port: <inspectorPort>,
     attachExistingChildren: true,
     continueOnAttach: false,
     attachSimplePort: <inspectorPort> (helps js-debug route)
   }
7) Wait for reverse `startDebugging` { configuration: { __pendingTargetId } }

Child session (adoption of pending target):
1) initialize
2) wait for initialized
3) setExceptionBreakpoints { filters: [] }
4) setBreakpoints { same source+line as parent, if applicable }
5) configurationDone
6) attach {
     __pendingTargetId: "<id>",
     continueOnAttach: false
   }
7) Wait for `stopped` (breakpoint) or fallback to `threads` + `pause`

This exact child flow is what made the probe consistently emit `stopped` and pass evaluation tests.

## Files of Interest

- Working probe: `scripts/experiments/js-debug-probe-attach.mjs`
- Reference test that guided behavior: `tests/e2e/javascript/simple-script.e2e.test.ts`
  - It uses a similar idea—force a single-session stop on entry and let js-debug adopt via `attachSimplePort`.

## Porting Plan to Proxy

You will implement this in:

- `src/proxy/minimal-dap.ts` (MinimalDapClient)
- `src/proxy/dap-proxy-worker.ts` (worker logic and gating)
- Optional light changes in `src/proxy/dap-proxy-adapter-manager.ts` are not expected

Concrete steps:

1) DAP handshake gating in parent:
   - After connecting to js-debug, send `initialize`, wait for `initialized`.
   - Only then send configuration requests:
     - `setExceptionBreakpoints` (send even if empty — consistent with VS Code behavior)
     - `setBreakpoints` for the `scriptPath`
   - Send `configurationDone`.
   - If in attach-mode (when we control the target), send `attach` (by port/address). If in launch-mode (when proxy is to start Node), send `launch` with `runtimeArgs: [--inspect-brk=<port>]` and include `attachSimplePort: <port>` so js-debug will generate the adoption path.

2) Handle reverse `startDebugging` for js-debug:
   - When receiving `startDebugging` with `__pendingTargetId`:
     - Create a new child DAP client connection to the SAME js-debug server.
     - Child flow (STRICT ORDER):
       - `initialize`
       - wait for `initialized`
       - `setExceptionBreakpoints`, `setBreakpoints`
       - `configurationDone`
       - `attach { __pendingTargetId, continueOnAttach: false }`
     - Route debuggee-scoped commands (threads, stackTrace, scopes, variables, evaluate, next/step) to the child session.
     - Forward child events to the parent emitter so the rest of the system sees a single stream.
   - Do NOT do a parent `attach` by inspector port after reverse startDebugging—this was a root cause of DI ambiguity and timeouts.

3) Fallback logic:
   - If no `stopped` event shows up promptly after adoption, poll `threads` and issue `pause(threadId)` to force a stop.
   - Keep timeouts and retries robust: 10–20s timeouts on long operations, with 150–200ms retry intervals.

4) Logging and traces:
   - Keep per-session DAP trace ndjson file (already wired).
   - Log requests and responses of critical operations (`setBreakpoints`, `configurationDone`, `attach`, `startDebugging`, `threads`, `pause`).

5) Tests:
   - Add an e2e scenario that mirrors the attach-probe behavior:
     - Start adapter
     - Parent: initialize -> config -> configDone -> attach(by port)
     - Validate reverse `startDebugging` flows and that a `stopped` event occurs
     - Assert evaluate and basic step/continue via child session works

6) Avoid regressions:
   - Maintain rules in MinimalDapClient to suppress parent attach by port if using single-session launch paths which already rely on child adoption (this suppression already exists in the repo; ensure it remains consistent with the new flow).
   - Keep explicit adapterID normalization for js-debug (`javascript` -> `pwa-node`) if needed in proxy to match adapter expectations.

## Rationale vs. Earlier Failures

- Parent attach and then another attach/launch by parent caused “Ambiguous match found for serviceIdentifier: je”.
- Sending configs before `initialized` (or sending `configurationDone` out of order) prevents js-debug from registering breakpoints in time.
- Relying on `launch` too early or mixing adoption with parent’s own attach by port can lead to no `threads` and no `stopped` events.

The winning approach keeps parent attach minimal and uses child adoption via `__pendingTargetId` as the source of truth for debugging operations.

## How to Run the Working Probe

From repo root:
```
node scripts/experiments/js-debug-probe-attach.mjs --program tests/fixtures/javascript-e2e/simple.js --line 8
```
Expected:
- A `stopped` event with reason `breakpoint`
- Variables and evaluate work (e.g., `1+1` → `"2"`)

## Implementation Checklist

- [ ] MinimalDapClient: ensure gating of configs by `initialized` and forward child events.
- [ ] DapProxyWorker: on js-debug sessions, enforce strict sequence and implement child adoption:
  - Parent: init -> initialized -> configs -> configDone -> attach
  - On startDebugging: child init -> initialized -> configs -> configDone -> attach(__pendingTargetId)
- [ ] Route debuggee-scoped commands to the active child session.
- [ ] Add threads+pause fallback when `stopped` is not emitted quickly.
- [ ] Add e2e tests mirroring attach-probe behavior; assert `stopped`, `variables`, `evaluate`.
- [ ] Keep suppression of parent attach by inspector port in single-session launch flows to avoid DI ambiguity.
- [ ] Maintain and review timeouts/retries in networked/CI settings.

## Final Notes

- The attach-probe has proven the sequencing and child-adoption work with our vendored js-debug.
- The next agent should implement this logic into the proxy with care to ordering and child session routing.
- Prefer clarity and logging over cleverness—js-debug is sensitive to sequencing and DI scope.
