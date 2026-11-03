# The session tree: a debuggee's children as debug sessions

The design for issue [#1005](https://github.com/debugmcp/mcp-debugger/issues/1005) part B:
when the program under debug starts a process that its debugger can report, that process becomes
a debug session of its own, linked to the session that spawned it. This document is the contract
(what an agent sees), the mechanics (where it lives in the server) and the staging (which adapter,
in what order). It is built from the measured facts in
[the Python spike notes](../python/spike-notes-subprocess.md) and
[the JavaScript spike notes](../javascript/spike-notes-forks.md); every claim about an adapter
below cites one of those or a source named in the survey.

Status: design accepted 2026-11-03 (the decisions and their owners are listed at the end);
implementation is tracked by [#1081](https://github.com/debugmcp/mcp-debugger/issues/1081) (M1, Python)
and [#1082](https://github.com/debugmcp/mcp-debugger/issues/1082) (M2, js-debug). Nothing here is
shipped yet.
Scope: debuggee children reported by the adapter (debugpy subprocesses, js-debug forks and, later,
browser targets). The tree is additive to the shipped tool surface: no new tool, no changed
parameter, new fields only.
Audience: whoever builds M1/M2, and whoever reads an answer with a `parentSessionId` in it.

## Why

One debug session is one program today: one thread list, one current stop, one breakpoint set, one
output buffer, and `continue`/`step`/`pause` aim at one process. A child the debuggee starts has
nowhere to live. The adapters that can report one are answered with silence (debugpy's report is
acknowledged and dropped, which parked the child until [#1008](https://github.com/debugmcp/mcp-debugger/pull/1008)
turned child debugging off) or with a single adoption (js-debug's first target is the program; every
later fork is released to run undebugged, [#501](https://github.com/debugmcp/mcp-debugger/issues/501)).

The cost is the places an agent most wants a breakpoint and cannot have one: pytest-xdist workers,
`multiprocessing` pools, Django's autoreloader child, Node `cluster` workers and job runners, test
runners that fork. Four open items defer on the same gap: this issue, the browser attach spike
([#989](https://github.com/debugmcp/mcp-debugger/issues/989): one target per page, frame and worker),
the test-runner presets ([#985](https://github.com/debugmcp/mcp-debugger/issues/985) M2 forces jest
and vitest single-worker) and execution tracing ([#987](https://github.com/debugmcp/mcp-debugger/issues/987):
which session a child's logpoint hits ride on).

The 2026-11-02 backlog review made this a pre-1.0 design task: the tree is additive, but it has to
be shaped before the tool-schema freeze ([ROADMAP](../../ROADMAP.md), path to 1.0) so that 1.0 does
not pin the single-program model by accident.

## The flow this design serves

> Set a breakpoint in the child's code. Start the parent. Wait. Inspect.

1. The agent sets a breakpoint on `worker.py:42` through the parent session, before or after
   launch. Breakpoints are per file; nothing is ever "assigned" to a process.
2. The agent starts the parent. When it spawns a Python child, debugpy starts that child under its
   own bootstrap and **parks it before any user code**, then reports it. The park holds until a
   client attaches and sends `configurationDone` (Python spike, *How debugpy reports a child*).
   js-debug does the same with `waitForDebugger` (JavaScript spike, *How js-debug reports a
   process*). Nothing the agent does or fails to do can let the child run first.
3. The server adopts the child on its own: a second connection to the same adapter, and during the
   hold before `configurationDone` it re-sends the parent's breakpoint set, so `worker.py:42` binds
   in the child. Then it releases the park. Measured: about 110 ms from report to first stop for
   debugpy, about 300 ms for js-debug (bounded by the fixture's first tick).
4. The child hits line 42 and stops. It is now a row in `list_debug_sessions` with
   `parentSessionId`.
5. The agent's `wait_for_stop` on the parent returns at that moment, carrying the child's session
   id and the ordinary stop answer. The agent inspects, steps and continues with that id.

There is no "ask for children, then set a breakpoint on the child, then race it" sequence. The
adapter holds the child for us; discovery is the only gap, and step 5 closes it.

## What the agent sees

### Sessions and rows

- A child is a session: its own id (a server-minted UUID, like every session), its own state
  machine, breakpoints, `wait_for_stop`, `get_output`, output resource and `close_debug_session`.
- `list_debug_sessions` rows gain one field, `parentSessionId`, present on child rows only. The
  root (launch or attach) row is unchanged. `language` is inherited from the parent. `name` is the
  adapter's own label for the process: `Subprocess <pid>` from debugpy, `<script> [<pid>]` from
  js-debug (the report's `name`; measured in both spikes). Both carry the pid, which is the only
  identity the report offers: debugpy's report names the *parent's* `program` and `cwd`, not the
  child's script.
- Children are created by the server, never by the agent. `create_debug_session` is unchanged and
  never makes one. `start_debugging`, `restart_debugging`, `attach_to_process` and
  `detach_from_process` on a child id are refused by name ("…is a child session; it was started by
  its parent"), the way the attach contract refuses undeclared addressing forms today. So are
  `expose_session` and `unexpose_session`: the DAP mirror is one server per worker forwarding the
  root's connection, so the root is what an IDE can follow; a per-connection mirror that shows each
  child as its own IDE session is a follow-up, not part of the tree.
- Grandchildren are children of the session that spawned them: the report arrives on the spawning
  process's connection in both adapters (Python spike, *Grandchildren*; JavaScript spike, row 7), so
  `parentSessionId` is a fact of routing, not a guess.
- `notifications/resources/list_changed` fires when a child is adopted and when one is closed, as
  it does for any session, and `resources/list` shows the child's output resource.

### `wait_for_stop` is tree-aware

A `wait_for_stop` on a session returns when that session **or any of its descendants** settles
(pauses, ends, errors). The answer carries `sessionId`: the id of the session that settled, equal
to the id asked for when it is the session itself. Everything else in the answer is the ordinary
stop answer for that session (`lastStop`, `location`, the stop snapshot, `exitCode` where one
exists). The agent then uses `sessionId` for inspection, stepping and continuing.

- A session with no children answers byte-for-byte as today, plus the `sessionId` field.
- The wait stays **level-triggered**, as today: it reads state and consumes nothing, so asking
  twice without resuming answers the same stop twice, two concurrent waiters get the same answer,
  and a later wait on the child's own id still answers the child's stop. What the tree adds is a
  deterministic choice when more than one session in the subtree is settled:
  1. the session itself, if it is paused or in error;
  2. otherwise the first live descendant that is paused or in error, in adoption order, depth first;
  3. otherwise the session itself, if it has ended;
  4. otherwise (only descendants have ended and the session still runs) the wait keeps waiting.
  A paused parent is reported before its paused children: the agent has to deal with it anyway,
  and the `children` list below shows what else is paused. A parent that ended while a child is
  paused reports the child (rule 2 before rule 3), because nothing can be done on the parent. The
  microtask re-check that hides an auto-continued entry stop
  ([#849](https://github.com/debugmcp/mcp-debugger/issues/849)) is unchanged.
- Every answer on a session that has children carries `children: [{ sessionId, name, state }]`,
  the paused and the `pending: true` answers included, so a caller always sees what else is live or
  paused and what to wait on next. The `start_debugging` answer carries the same list when a child
  was adopted during the launch hold.
- A `wait_for_stop` on a child answers for that child and its own descendants only.

This was decided over the per-session alternative (each wait answers only its own stops): that
reading is freeze-pure but turns the flow above into a timeout and a second round trip, because
the agent has only the parent's id when it starts waiting.

### Breakpoints

Breakpoints never carry over on the wire: a breakpoint set on the parent's connection is verified
on the parent and never stops the child, in both adapters (Python spike, *What does not carry
over*; JavaScript spike, row "Breakpoints"). So:

- At adoption the server re-sends the parent's current breakpoint set (line, function and
  exception filters) to the child during the hold before `configurationDone`, which is the one
  window in which they bind before user code. From then on each session's set is its own:
  `set_breakpoint` on the child id changes the child only, and a later `set_breakpoint` on the
  parent is not mirrored to children already running.
- `stopOnEntry` on the child's attach is a no-op (measured for debugpy; js-debug's
  `continueOnAttach` resumes). The entry stop a child would show is the breakpoint the agent set.
- `list_breakpoints` on the child reports the child's verified set with the child's adapter ids.

### Output

The launch session's buffer is the whole tree's output. That is already true for both adapters
and nothing is deduplicated: forks inherit the parent's pipes, so every child line arrives as an
`output` event on the launch session's connection (Python spike, *Output*; JavaScript spike,
*Output*).

A child's own buffer carries its own lines **where the adapter can attribute them**:

- debugpy can: with `redirectOutput: true` in the child's attach, the child's stdout and stderr
  also arrive on the child's connection. The child's `get_output` and
  `debug://sessions/<child>/output` show the child's lines; the parent's show the tree.
- js-debug cannot: all output of the tree arrives on the root connection and child sessions carry
  no `output` events at all. A js-debug child's `get_output` answers with an empty page and a note
  that its output is on the launch session (`outputOn: <launch session id>`); its resource reads
  the same way.

The attribution is one per-adapter policy pin (below). The per-process-only alternative (each
session carries only its own process's lines) is not implementable: js-debug offers no
attribution, and the parent's copy of a debugpy child's lines arrives through the inherited pipe
with no pid on it.

### Exit

A child is an attach session on the wire and ends with `terminated` and no `exited`, in both
adapters (Python spike, cascade row 1; JavaScript spike, *Exit*). A child row therefore carries no
`exitCode`; its state goes to `stopped` with `programEnd` describing the end the adapter reported.
Two measured effects the answers name:

- A paused Python child outlives a parent that exits, and holds the parent's `exited` until the
  child ends, because the child inherited the parent's stdout pipe (Python spike, cascade row 2;
  the [#993](https://github.com/debugmcp/mcp-debugger/issues/993) mechanism). While that is the
  case the parent row says `running` and its `wait_for_stop` reports the child.
- A js-debug program's exit kills its unreported children within 300 ms (JavaScript spike, cascade
  row 2); a fork reported and adopted before that is a session until it ends.

### Closing

- `close_debug_session` on a parent closes the subtree: children first (deepest first), then the
  parent. The whole tree is gone afterwards (Python spike, row 6; JavaScript spike, row 6: only the
  root's `disconnect` ends a js-debug tree, and it never answers, so the worker's timeout-then-tree-kill
  stays).
- `close_debug_session` on a child closes that child only. What happens to the process is the
  adapter's: debugpy terminates it (exit 0 reported to the parent, Python spike, row 4); js-debug
  cannot end a child it adopted (the process keeps running undebugged, JavaScript spike, row 3).
  The answer says which (`processEnded: true` / `released: true`).
- A session that ended stays listed until it is closed, as today, so an agent can still read a
  child's `programEnd` and its output. Closing the parent removes its ended children with it.
- `detach_from_process` on an attach root with children cascades as a detach: every child is
  detached first, deepest first (`disconnect(terminateDebuggee: false)` on its connection: a
  debugpy child resumes and runs undebugged, Python spike row 3; a js-debug child keeps running,
  JavaScript spike row 3), then the parent. The child rows go `stopped` with `released: true`. The
  children's connections live in the parent's worker, so they cannot outlive the detach; the
  parent-side order with several children is the one step here the spikes did not measure, and the
  M1 suite does.
- `restart_debugging` on a parent ends the previous run's children with that run: they are closed
  and removed (a relaunch is a new program, and children belong to a run), and the restart answer
  says `childrenClosed: n`. Neither detach nor restart ever classifies children as `error`; that row
  of the cascade table is for a worker that dies unexpectedly.

### On by default, opt-out per launch

Adoption is on by default. The Python launch transform stops defaulting `subProcess` to `false`
(that default existed only because of the park hang, which adoption removes; the warning that
names the hang goes with it) and the JavaScript launch and attach transforms default
`autoAttachChildProcesses` to `true` (the attach path's `false` was #501's wedge guard, which
adoption replaces; the `attach_to_process` schema text that states it changes with it). An
explicit `false` in `dapLaunchArgs` (or in `adapterConfig` for an attach) turns adoption off for
that session and children run undebugged, as they do today. Each flip ships in the milestone that
makes it safe (M1 for Python, M2 for js-debug), as a documented behaviour change with a `changed`
changelog entry, because it changes what a launch that spawns Python or Node processes shows:
child rows for every xdist worker, autoreloader child or script that shells out.

The Python **attach** transform flips in M1 only once its own measurement passes: the spike's
topology is a launch served by `python -m debugpy.adapter`, and whether a by-port attach's children
report on the same connection with the same `connect` body is unmeasured. M1 includes that
fixture; if it reports the same way, the attach default flips with the launch default, otherwise
attach keeps `subProcess: false` and its warning until a follow-up measures it.

Two bounds keep that sane:

- A per-tree cap on live children (`DEBUG_MCP_MAX_CHILD_SESSIONS`, default 32; `0` disables
  adoption). Beyond the cap the release lever runs (the child runs undebugged) and the parent's
  next answer says so (`childrenReleased: n`).
- Ended children stay listed until closed, as above, and leave with their parent.

## Every adapter, surveyed

The Debug Adapter Protocol has exactly one mechanism for a debugger to hand a client a new
process: the `startDebugging` reverse request, sent only when the client's `initialize` advertised
`supportsStartDebuggingRequest`, which "should start a new debug session (of the same type as the
caller)" and which a client with hierarchical sessions "can treat as a child of the caller session"
([specification](https://microsoft.github.io/debug-adapter-protocol/specification#Reverse_Requests_StartDebugging)).
Two engines in our set implement it. The others either follow a child in place of the parent,
fold children into the one session, or ignore them. Surveyed 2026-11-03:

| adapter | engine | mechanism | release lever | child output | today's route to a child | source |
|---|---|---|---|---|---|---|
| python | debugpy 1.8.20 | `startDebugging` when advertised, else a `debugpyAttach` event with the same body; child parked until a client attaches | reject the request: the adapter unblocks the child itself, 100 ms | own lines on the child connection with `redirectOutput`, plus the parent's pipe copy | none (a parked child cannot be attached by the agent: no port is reported to it) | [spike notes](../python/spike-notes-subprocess.md), measured |
| javascript | js-debug 1.140.0 | one `startDebugging { __pendingTargetId }` per process, incl. the program itself; child parked in `waitForDebugger` | a throwaway attach-then-detach ([#501](https://github.com/debugmcp/mcp-debugger/issues/501)); rejecting parks the child forever | tree-wide on the root connection, no attribution | `attach_to_process` by pid or inspector port, which is a new root, not a child | [spike notes](../javascript/spike-notes-forks.md), measured |
| javascript (browser) | js-debug `pwa-chrome` | the same `startDebugging`, one per page, frame and worker | as above | unmeasured | none | [#989](https://github.com/debugmcp/mcp-debugger/issues/989), unmeasured |
| ruby | debug gem 1.11.0 (rdbg) | **out of band**: with `fork_mode: both` (the default) the forked child runs `SESSION.activate on_fork: true` and opens its own debug server — the same TCP port with `RUBY_DEBUG_PORT_RANGE` unset (ten retries, then it raises), the next free port in the range otherwise — announced only by a `Debugger can attach via TCP/IP (host:port)` line on the child's stderr; nothing on the parent's DAP connection | not needed: the child is not parked | the child's stderr reaches the launch session through the inherited pipe | `attach_to_process` by port against the child's own server (the adapter already connects to `rdbg --open` sockets directly), a new root | debug gem source read 2026-11-03: `lib/debug/session.rb` `__fork_setup_for_debugger`, `lib/debug/server.rb` `UI_TcpServer#accept`; Ruby on Windows has no `fork`, so a measurement needs Linux |
| rust, cpp, cobol | CodeLLDB / LLDB 22.1.8 | **follow**: `target.process.follow-fork-mode` is `parent` or `child` — the debugger keeps one process and releases the other; `stop-on-exec` is `true`; Linux and FreeBSD only; never a report, never a second session | not applicable | not applicable | cpp and cobol: `attach_to_process` by pid, a new root; rust: no attach mode | setting values read from the vendored `lldb.exe` 2026-11-03 (`follow-fork-mode = parent`); [LLVM D100503](https://reviews.llvm.org/D100503) |
| go | Delve (CI pins 1.24.2 as the oldest supported, 1.27.2 current) | **follow and fold**: `target follow-exec [-on [regex]]` attaches to child processes the target execs, `target list` / `target switch` move between them inside the one session; DAP `launch` takes `followExec` / `followExecRegex` since 1.26.0 (attach: "not supported yet"); one `process` event, one goroutine list; Linux first (1.21.0), Windows follow since 1.21.2 | not applicable | not applicable | no attach mode | Delve CHANGELOG 1.21.0 / 1.21.2 / 1.26.0 / 1.27.1, `Documentation/cli/README.md` (`target`), `service/dap/server.go` (`followExec`), read 2026-11-03; how a second target is presented over DAP is unmeasured |
| java | the JDI bridge (`JdiDapServer.java`) | none: a child JVM is a new process that needs its own JDWP agent; JDI has no process following | not applicable | not applicable | `attach_to_process` by JDWP port, a new root | our own bridge; no `startDebugging`, no child handling in it |
| dotnet | netcoredbg | none documented | not applicable | not applicable | `attach_to_process` by pid, a new root | netcoredbg README (attach by pid only; nothing on child processes), read 2026-11-03 |
| dart, flutter | the SDK's own adapters | none: isolates are threads of one VM and already appear as threads (each new isolate pauses at start and is reported as an entry stop the policy resumes); a `Process.start` child is another VM, not followed | not applicable | not applicable | `attach_to_process` by VM-service URI, a new root | [Dart spike notes](../dart/spike-notes.md); no `supportsStartDebuggingRequest` anywhere in `dart-lang/sdk` (code search 2026-11-03) |
| mock | — | none | — | — | — | test double |

What the table decides:

- The tree, as a reported-child mechanism, covers Python and JavaScript, and later the browser
  targets. That is the whole population of adapters that can report a child, not a sample.
- rdbg is the one engine with a real multi-process story of a different shape: the child publishes
  an endpoint instead of a report. Adopting it would mean reading the child's announcement off the
  launch session's captured stderr and attaching to that port, which is the adapter's existing
  attach path. It is feasible in this design (a policy whose report source is an output line) and
  unmeasured; `fork` does not exist on Windows, so the spike runs on Linux. It is a milestone only
  after that spike.
- Delve's follow-exec folds children into one session, which is the multiplexing shape this design
  rejects for the tree (below); it is not adopted here. Whether a Delve launch with `followExec`
  should be forwarded as-is for users who want Delve's own behaviour is a Go adapter question, not a
  tree question.
- Every other adapter gets no adoption and keeps today's route: `attach_to_process` creates a new
  root session, with no link to the parent (linking a manual attach to a parent would need a tool
  parameter, which the freeze forbids).

**The generality rule.** Every row above reduces to pins on `AdapterPolicy` with no special-casing
in the core: the adapter policy pattern is how every other per-adapter difference in this server is
expressed ([adapter-policy-pattern.md](adapter-policy-pattern.md)), and all eleven policies pin
`childSessionStrategy: 'none'` today except js-debug. `'none'` stays the default; the cross-policy
contract test (`tests/unit/shared/adapter-policy-contract.test.ts`) grows the new members when M1
lands, so a policy that says `'none'` is proven to never adopt and one that reports is proven to
name its release lever and its output attribution.

## The alternative rejected

One session for the whole tree, with child stops surfacing on the parent's id and every
`continue`, `step`, `get_stack_trace` naming which process: this is what the #1005 body rejected
and this design keeps rejecting. It changes what every existing answer means; thread ids collide
(debugpy numbers them per process, so the parent and each child all report thread 1; js-debug
happens to number them across the server); and neither DAP nor VS Code does it — the protocol's
own mechanism is a new session per child. The tree keeps the per-process session and adds routing
on top.

## Where it lives

### One worker per tree

A child's connection lives in the **parent's proxy worker**. Three measured constraints force it:
the parent's worker spawns the adapter process and owns the tree kill that ends it; the child's
report arrives on the parent's own DAP connection inside that worker; and the adapter accepts N
client connections on the one port it already serves (Python spike, *Two adapter facts*;
JavaScript spike, *What a second connection needs*). A child worker would hold a connection to an
adapter it does not own and would learn of children only through the parent's worker anyway.

So the worker keeps a map `sessionId → MinimalDapClient`: the parent's connection under the
session id it was started with, one more per adopted child, each driven through today's child
handshake (`initialize → attach(config) → initialized → setBreakpoints → configurationDone`) on a
fresh socket to the same adapter port. Every connection the worker opens it also closes: the
debugpy adapter lives while any client socket is open and exits when a session-less client
disconnects (Python spike, *Two adapter facts*).

### Events are tagged, not re-emitted

Today the one js-debug child's events are re-emitted as if the parent sent them
(`src/proxy/minimal-dap.ts`, `childEvent` → `this.emit(evt.event, …)`), which is right for the
program's own target and wrong for a sibling: a child's `terminated` re-emitted as the parent's
would run the worker's `onTerminated` → `shutdown()` and tear the tree down. In the tree, every
DAP event and response the worker forwards carries the session id of the connection it came from.
The IPC envelopes already have that field (`sessionId` on `StatusMessage`, `DapResponseMessage`,
`DapEventMessage`, `ErrorMessage` in `src/proxy/dap-proxy-interfaces.ts`); today one worker is one
session and `ProxyManager` ignores it. The parent-process `ProxyManager` becomes the demultiplexer:
it keeps the parent's own handlers as they are and hands each child's traffic to a **child proxy
view** — an `IProxyManager` over the same IPC channel, filtered to that child's id, with
`sendDapRequest` tagging the request with the id so the worker routes it to the right connection.

The session layer then needs nothing new per operation: a child is a `ManagedSession` whose
`proxyManager` is its view, wired with the same event handlers (`handleStopped`, `handleOutput`,
`handleTerminated`, …), its own `OutputRingBuffer`, its own breakpoint store and state machine. The
`InFlightGuard`, the pause coordinator, the stop anchor and the snapshot all work per session as
they do now. Only three things are tree-specific in the core:

- adoption: on the parent `ProxyManager`'s `child-reported` event, `SessionManager` creates the
  child session (`parentSessionId`, inherited language, the report's name), snapshots the parent's
  breakpoints into it, and tells the worker to adopt with that set (the hold before
  `configurationDone` is where they bind);
- the tree-aware wait: `waitForStop` subscribes to the state of the session and its descendants and
  reports the earliest settle;
- the cascade on close, and the per-tree cap.

### The adoption contract on `AdapterPolicy`

`childSessionStrategy` grows from a strategy name into a contract with these members (names are
the builder's; the members are the design):

- **report recognition**: how a child report is recognised on a connection — a `startDebugging`
  reverse request (both engines) or an event (`debugpyAttach` when the request form was not
  advertised); the body fields that name the child (`subProcessId` / `__pendingTargetId`, `name`,
  `connect`);
- **advertise**: whether the worker's `initialize` sets `supportsStartDebuggingRequest: true`
  (Python: yes, so the report is a request and carries the release lever; js-debug already
  advertises it in its own handshake);
- **attach arguments**: `buildChildStartArgs` as today, from the report's configuration
  (debugpy: the configuration as delivered; js-debug: `attach { __pendingTargetId,
  continueOnAttach: true }`);
- **release lever**: what releases an unadopted child — debugpy: answer the request with
  `success: false` (the adapter unblocks the child itself, 100 ms); js-debug: the throwaway
  attach-then-detach of #501, and never `success: false` (that parks the child forever);
- **output attribution**: whether the child's connection carries the child's own output (debugpy
  with `redirectOutput: true`; js-debug: never);
- **end semantics**: what `close_debug_session` on a child does to the process (debugpy: terminates
  it; js-debug: releases it) and whether the root's `disconnect` answers (js-debug: no);
- the existing `childRoutedCommands`, `mirrorBreakpointsToChild`, `pauseAfterChildAttach`,
  `childInitTimeout` and `isChildReadyEvent` keep their roles for the program's own target.

For js-debug the first adoption keeps its special meaning: the program itself arrives as a
`startDebugging` and its adoption is the launch-ready signal
([#704](https://github.com/debugmcp/mcp-debugger/issues/704); `dap-proxy-worker.ts`,
`child-adopted` → `reportConfiguredAndLaunched`). That target stays routed inside the launch
session as today (`ChildSessionManager`'s single child). Every later report — a fork, and a
grandchild's report on a fork's connection, which `createChildSafePolicy` hands back to the manager
today — becomes a child session instead of a release. The single-child gate becomes the per-tree
cap.

For debugpy the policy advertises the request form, recognises both forms, and treats the
delivered configuration as the attach body; `redirectOutput: true` stays on the child (own lines),
and the `program`/`cwd` in the report (the parent's) are not used for anything but the attach.

## Lifecycle: the cascade contract

One row per measured fact; the "answer" column is what this design adds on top of the behaviour.

| event | debugpy | js-debug | answer |
|---|---|---|---|
| child exits while the parent is paused | child `terminated`; the parent, once continued, sees the exit and ends normally (row 1) | same (row 1) | the child row goes `stopped`; the parent's wait reports the child's end if nothing else settled first |
| parent exits with a child live | the parent's `exited` is held until the child ends (inherited stdout pipe, #993); the child stays debuggable (row 2) | the program's exit kills unreported children within 300 ms; an adopted child is a session until it ends (row 2) | Python: the parent row stays `running` and its wait reports the child; the child row carries `parentSessionId` of a parent that is gone when it finally ends |
| `close_debug_session` on a child | `disconnect(terminateDebuggee: true)`: the child ends, exit 0 reported to the parent (row 4) | `disconnect` with either flag leaves the child running (row 3) | `processEnded: true` / `released: true` |
| `close_debug_session` on the parent | `disconnect(terminateDebuggee: true)` on the parent ends the tree (row 6) | only the root's `disconnect` ends the tree, and it never answers (row 6); `terminate` or `disconnect` on a program or child session leave the processes alive (rows 4–5) | children closed deepest-first, then the parent; the worker's timeout-then-tree-kill stays the backstop |
| `detach_from_process` on an attach root with children | each child's `disconnect(terminateDebuggee: false)` resumes it undebugged (row 3) | each child keeps running (row 3) | children detached deepest-first (`released: true`), then the parent; the parent-side order with several children is measured by the M1 suite |
| `restart_debugging` on a parent | the relaunch ends the previous run's processes (row 6) | same (row 6) | the previous run's children are closed and removed; `childrenClosed: n` |
| grandchildren | reported on the child's connection, adopted there, `terminated` cascades bottom-up (row 7) | same (row 7) | `parentSessionId` = the child; the cap counts the whole tree |
| the HTTP client's MCP session ends (stale, stream lost, `DELETE /mcp`) | — | — | that client's server stops and closes all its sessions, trees included, as today |
| the parent's worker dies | — | — | every session in the tree goes to `error` with the parent's diagnostics; the adapter process is reaped by the worker's exit path as today |

Per-session machinery that stays per session: the `InFlightGuard` (a child never launches or
attaches through the tools, so it only guards `detach`-shaped refusals), the pause coordinator, the
stop anchor, the snapshot limits, secret redaction, the idle policy below.

## Ownership and lifetime

Decided 2026-11-03 on [#1025](https://github.com/debugmcp/mcp-debugger/issues/1025) for the move
to protocol 2026-07-28, and written here once because the tree is where it first matters:

**The handle is the capability.** A debug session's owner is whoever holds its id. Session ids are
unguessable, server-minted UUIDs passed as ordinary tool arguments; that is already the model of
`expose_session` (token as capability) and of stdio, where one process serves one client. A child
inherits whatever its parent has server-side; `parentSessionId` adds nothing to the ownership
story. Ownership never becomes a tool parameter.

Two guardrails:

1. In the modern era (no protocol-level MCP session) `list_debug_sessions` is the whole process's
   list; the session `name` is the agent's own namespace hint. Several agents against one `http`
   process see each other's sessions: that is a single-tenant statement, and one server process
   per agent is the isolation, as stdio and the dev proxy already give. The legacy era's per-client
   server and foreign-session refusal ([#939](https://github.com/debugmcp/mcp-debugger/issues/939))
   are that era's behaviour, not a contract.
2. Lifetime without an MCP session (today the stale reaper's trigger, `MCP_HTTP_STALE_SESSION_MS`)
   becomes a **per-debug-session idle policy**: `MCP_DEBUG_SESSION_IDLE_MS`, default thirty minutes,
   `0` disables, where activity is any tool call naming that session, so a long `wait_for_stop`
   counts as activity for its whole duration. A child's clock is its own; closing an idle parent
   cascades. Explicit close and debuggee exit end a session sooner, as today.

If real authentication ever arrives, the authenticated principal becomes the owner key with no
schema change.

## Milestones

**M1 — Python children as sessions ([#1081](https://github.com/debugmcp/mcp-debugger/issues/1081)).** The policy contract above with the Python pins; the worker
advertises `supportsStartDebuggingRequest` and keeps N connections; `ProxyManager` demultiplexes
by session id and the child proxy view; `SessionStore` and `DebugSessionInfo` grow
`parentSessionId`; adoption with the parent's breakpoints; tree-aware `wait_for_stop` with
`sessionId` and `children`; the cascades on close, detach and restart; the cap; `expose_session`
refusing children; the launch `subProcess` default flips to on with a `changed` entry, the attach
default with it if the attach fixture reports the same way; `list_debug_sessions` and `wait_for_stop` reference sections; the
`python-subprocess-inherit` fixtures become the regression suite (a child stops on a breakpoint
set before launch; xdist workers; grandchildren; the cascade rows). Seams: `src/proxy/minimal-dap.ts`
(reverse requests, event tagging), `src/proxy/dap-proxy-connection-manager.ts` (`initialize`),
`src/proxy/dap-proxy-worker.ts` (connection map, routing, shutdown), `src/proxy/proxy-manager.ts`
(demultiplexing), `src/session/session-store.ts` and `packages/shared/src/models/index.ts`
(`parentSessionId`), `src/session/session-manager-core.ts` (adoption, cascade),
`src/session/execution/execution-controller.ts` (the wait), `src/server/handlers/session-tools.ts`
(rows), `packages/shared/src/interfaces/adapter-policy*.ts` (the contract),
`packages/adapter-python/src/python-debug-adapter.ts` (the default).

**M2 — js-debug N targets ([#1082](https://github.com/debugmcp/mcp-debugger/issues/1082)).** `ChildSessionManager`'s single-child gate becomes the per-tree cap;
every report after the program's own becomes a child session; grandchild reports on child
connections are adopted instead of released; #501's throwaway attach stays the release lever and
the only one; `autoAttachChildProcesses` defaults on for launch and attach with a `changed` entry
(the `attach_to_process` schema text changes with it); the attach smoke that
today expects release ([`tests/e2e/mcp-server-smoke-javascript-attach.test.ts`](../../tests/e2e/mcp-server-smoke-javascript-attach.test.ts))
expects adoption. Unblocks #985 M2 (jest and vitest workers as sessions).

**M3 — browser targets.** After the [#989](https://github.com/debugmcp/mcp-debugger/issues/989)
spike: the same mechanism, one session per page, frame and worker; the attach-addressing form is
new (CDP URL or port) and goes through the attach contract.

**Conditional — rdbg forks.** Gated on a Linux spike of the debug gem's fork behaviour under
`rdbg --open --port` (what the child opens, how the announcement reaches the launch session's
output, whether a second direct connection debugs it). A milestone only if that spike is a go.

[#987](https://github.com/debugmcp/mcp-debugger/issues/987) (trace hits) inherits the tree: a
child's logpoint hits are the child session's.

## Decisions and their owners

Taken by the project owner on 2026-11-03, after the spike:

- `wait_for_stop` is tree-aware (over per-session).
- Adoption is on by default, with per-launch opt-out (over opt-in behind the existing keys).
- Output is the tree on the launch session plus a child's own lines where the adapter can attribute
  them (over tree-only or per-process-only).
- Ownership: the handle is the capability (on #1025).
- Every adapter is surveyed in this document with a source, and measurement is added where the
  survey finds a mechanism (rdbg).

Taken by the author of this document, marked so they can be overturned:

- The child's connection lives in the parent's worker (the constraints above).
- The per-tree cap defaults to 32 and is named `DEBUG_MCP_MAX_CHILD_SESSIONS`; `0` disables
  adoption.
- The idle policy knob is named `MCP_DEBUG_SESSION_IDLE_MS`.
- The ordering rule for several settles before one wait (parent first, then adoption order).
- Ended children stay listed until closed, and leave with their parent.
- The answer field names: `sessionId`, `children`, `outputOn`, `processEnded`, `released`,
  `childrenReleased`.
- The launch-shaped tools refuse a child id by name rather than operating on its parent, and so
  does `expose_session` (the mirror follows the root; a per-connection mirror is a follow-up).
- The wait stays level-triggered with the four-rule priority above: no settle log, no cursors.
- Detach cascades as a detach (children released); restart closes and removes the previous run's
  children; neither classifies children as `error`.
- The Python attach default flips in M1 only on its own measurement; the js-debug attach default
  flips in M2 together with the launch default.

## Left to the builder

- The IPC request routing: whether a child's requests travel in the existing `dap` command with the
  session id set, or a new command; the worker's per-connection request queue.
- How the child proxy view implements `IProxyManager`'s process-level members (`stop`, `isRunning`,
  pid) — they belong to the parent's worker and the view delegates or refuses.
- Whether the tree-aware wait is a second `waitForSessionState` over a set of ids or a subscription
  on the parent's descendants; it must keep the microtask re-check that hides auto-continued entry
  stops ([#849](https://github.com/debugmcp/mcp-debugger/issues/849)).
- The regression suite's exact fixtures beyond `python-subprocess-inherit`.
- The reference-doc wording for the new fields.

## Sources

- [Python spike notes](../python/spike-notes-subprocess.md) and
  [JavaScript spike notes](../javascript/spike-notes-forks.md), measured 2026-11-03.
- [Debug Adapter Protocol specification](https://microsoft.github.io/debug-adapter-protocol/specification):
  `StartDebugging`, `supportsStartDebuggingRequest`, the `process` event.
- Ruby debug gem 1.11.0 source (`lib/debug/session.rb`, `lib/debug/server.rb`, `lib/debug/config.rb`).
- Vendored CodeLLDB (LLDB 22.1.8) `settings show target.process.follow-fork-mode`; LLVM review
  [D100503](https://reviews.llvm.org/D100503).
- Delve `CHANGELOG.md`, `Documentation/cli/README.md`, `service/dap/server.go`.
- netcoredbg `README.md`; `dart-lang/sdk` code search; this repository's own JDI bridge.
- Issues [#1005](https://github.com/debugmcp/mcp-debugger/issues/1005),
  [#501](https://github.com/debugmcp/mcp-debugger/issues/501),
  [#985](https://github.com/debugmcp/mcp-debugger/issues/985),
  [#987](https://github.com/debugmcp/mcp-debugger/issues/987),
  [#989](https://github.com/debugmcp/mcp-debugger/issues/989),
  [#993](https://github.com/debugmcp/mcp-debugger/issues/993),
  [#1025](https://github.com/debugmcp/mcp-debugger/issues/1025).
