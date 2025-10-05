# Handoff Prompt: Integrate Working js-debug Flow into MCP Debugger

You are taking over to integrate a now-verified JavaScript debugging flow (using the vendored VS Code js-debug adapter) into the MCP Debugger proxy. Prior attempts failed to pause at breakpoints; we now have a reproducible sequence that does pause and supports variables/evaluate.

Your goals:
1) Port the working DAP handshake into the proxy (MinimalDapClient + DapProxyWorker).
2) Ensure reverse startDebugging (__pendingTargetId) is handled in a strict, spec-compliant sequence via a dedicated child session.
3) Add an e2e test that demonstrates stopping at a breakpoint, evaluate, and step/continue.
4) Keep logging, retries, and timeouts robust to avoid race conditions/DI ambiguity.

Background and rationale:
- js-debug uses a multi-session model. The parent launcher session remains active; actual debugging occurs in a child session that js-debug requests via reverse startDebugging(__pendingTargetId).
- Breakpoint failures were mostly ordering and DI/attach ambiguity problems. The parent attach by inspector port should happen only initially; then a child session adopts the pending target by __pendingTargetId using strict DAP ordering. Avoid subsequent parent attaches-by-port that cause DI ambiguity (“Ambiguous match found for serviceIdentifier: je”).
- Strict ordering is critical:
  - Parent (single-session attach flow when we control the target):
    1) initialize
    2) wait for initialized
    3) setExceptionBreakpoints (send even if empty)
    4) setBreakpoints
    5) configurationDone
    6) attach { address, port, attachExistingChildren: true, continueOnAttach: false, attachSimplePort: <port> }
    7) Wait for reverse startDebugging { __pendingTargetId }
  - Child (adoption of pending target):
    1) initialize
    2) wait for initialized
    3) setExceptionBreakpoints
    4) setBreakpoints
    5) configurationDone
    6) attach { __pendingTargetId, continueOnAttach: false }
    7) Wait for stopped (breakpoint); fallback: threads + pause

Artifacts that prove this works:
- scripts/experiments/js-debug-probe-attach.mjs: a standalone probe that:
  - Spawns vendored js-debug (vsDebugServer.cjs) on TCP
  - Spawns a Node target with --inspect-brk=<freePort>
  - Parent attach by port after sending configs and configurationDone
  - On reverse startDebugging(__pendingTargetId) creates a child DAP session and follows strict ordering to attach(__pendingTargetId)
  - Observes a “stopped” event with reason=breakpoint and confirms variables/evaluate
- docs/js-debug-handoff.md: Detailed background, verified sequence, and the porting plan.

Files to examine:
- src/proxy/minimal-dap.ts (MinimalDapClient)
  - Ensure: 
    - initialize → wait initialized → only then send config requests → configurationDone
    - On startDebugging, open a new child DAP client, apply strict child sequence, attach(__pendingTargetId)
    - Forward child events to parent stream; route debuggee-scoped requests (threads/stackTrace/scopes/variables/evaluate/step/continue) to child
    - Avoid parent attaches by inspector port during adoption flows; suppress DI-ambiguous actions
- src/proxy/dap-proxy-worker.ts (DapProxyWorker)
  - Ensure proper gating/state for js-debug sessions
  - Make sure parent session does initial attach/launch only after config done; for attach mode, attach by inspector port just once
  - Queue and route DAP requests appropriately pre/post initialize and pre/post child adoption
- tests/e2e/javascript/simple-script.e2e.test.ts
  - Mirrors needed sequencing; use it as a model but add a new test that explicitly reflects the attach-probe behavior (parent attach by port, then child adoption by __pendingTargetId) and asserts: stopped event, variables present, evaluate('1+1') = "2", and stepping/continue works.

Acceptance criteria:
- End-to-end: Run the new e2e test and observe:
  - A stopped event at the intended breakpoint (or after pause fallback)
  - stackTrace/scopes/variables working
  - evaluate('1+1') yields "2"
  - next/continue flow works to program termination
- No DI ambiguity errors in logs (“Ambiguous match found for serviceIdentifier: je”).
- No timing deadlocks during child adoption; reverse startDebugging handled consistently.
- Logging includes clear traces for initialize/initialized, setExceptionBreakpoints, setBreakpoints, configurationDone, attach, startDebugging, threads, and pause.

Do:
- Follow the strict DAP order in both parent and child sessions
- Always wait for “initialized” before config requests, and send configurationDone before attach/start
- Use __pendingTargetId for child adoption
- Keep timeouts/retries (e.g., 10–20s) and thread polling fallback+pause

Don’t:
- Don’t attach the parent by inspector port after the child adoption begins (DI ambiguity)
- Don’t send config requests before “initialized”
- Don’t rely on launch-first patterns that skip config ordering

Quick run command for the working probe:
- node scripts/experiments/js-debug-probe-attach.mjs --program tests/fixtures/javascript-e2e/simple.js --line 8

If you need to examine behavior, check logs/dap-probe-attach-*.ndjson for the DAP trace of requests/events.

Summary:
Integrate the proven attach+child-adoption DAP behavior into the proxy. Ensure strict ordering, route debuggee-scoped requests to the active child, and add an e2e test to guard against regressions. This will transition the project from “cannot pause js” to a reliable, testable js-debug integration.
