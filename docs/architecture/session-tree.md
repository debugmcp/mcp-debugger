# The session tree: a debuggee's children as debug sessions

The design for issue [#1005](https://github.com/debugmcp/mcp-debugger/issues/1005) part B:
when the program under debug starts a process that its debugger can report, that process becomes
a debug session of its own, linked to the session that spawned it. This document is the contract
(what an agent sees), the mechanics (where it lives in the server) and the staging (which adapter,
in what order). It is built from the measured facts in
[the Python spike notes](../python/spike-notes-subprocess.md) and
[the JavaScript spike notes](../javascript/spike-notes-forks.md); every claim about an adapter
below cites one of those or a source named in the survey.

Status: decisions taken 2026-11-03 (listed with their owners at the end); merged in
[#1083](https://github.com/debugmcp/mcp-debugger/pull/1083). M1
([#1081](https://github.com/debugmcp/mcp-debugger/issues/1081), Python) is complete: PR 1
(adoption behind an explicit `subProcess: true`) merged in
[#1087](https://github.com/debugmcp/mcp-debugger/pull/1087), PR 2 (the tree-aware wait and the
cascade answers) in [#1090](https://github.com/debugmcp/mcp-debugger/pull/1090), PR 3 (on by
default, the attach measurement, the lifecycle suites) in
[#1091](https://github.com/debugmcp/mcp-debugger/pull/1091). M2
([#1082](https://github.com/debugmcp/mcp-debugger/issues/1082), js-debug) is complete: PR 1
(the mechanism behind an explicit `autoAttachChildProcesses: true` — every report after the
program's own is a child session, the throwaway release, `outputOn`, a child's close as a release,
the fork/grandchild suite and the parent-exit measurement below) merged in
[#1094](https://github.com/debugmcp/mcp-debugger/pull/1094), PR 2 (the launch and verified-local
attach defaults on, the attach, cascade and cluster suites) in
[#1096](https://github.com/debugmcp/mcp-debugger/pull/1096).
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

A `wait_for_stop` on a session observes that session **and all its descendants**. It returns a
pause or error from that subtree, or the requested session's end, using the priority below. An
ended descendant alone does not complete an ancestor's wait. The answer carries `sessionId`: the
id selected by that priority, equal to the id asked for when it is the session itself. Everything
else in the answer is the ordinary
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
  When rule 3 answers a session's end, the end summary is the tree's (issue #1128): a stop the
  agent could see on any descendant is counted on every ancestor (`descendantStops`, per run — the
  child's own record leaves with its row at its close), and a session that never stopped itself
  but whose tree did says "Its child sessions stopped N times during this run" instead of
  "without hitting any breakpoint", listing no breakpoint as unhit.
  A paused parent is reported before its paused children: the agent has to deal with it anyway,
  and the `children` list below shows what else is paused. A parent that ended while a child is
  paused reports the child (rule 2 before rule 3), because nothing can be done on the parent. The
  microtask re-check that hides an auto-continued entry stop
  ([#849](https://github.com/debugmcp/mcp-debugger/issues/849)) is unchanged.
- Every answer on a session that has children carries `children: [{ sessionId, name, state, parentSessionId }]`,
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
  Under load js-debug can leak its own module-entry break as a first-stop "debugger statement"
  pause at the module's first statement (issue #1097); the core holds such a first stop, reads
  the source line under its top frame, and resumes it unseen unless the line holds a `debugger`
  statement — the same check a root launch's first stop gets. Named breakpoint hits are
  preserved. The lookup has a three-second budget, including the file read; an unavailable
  line or adapter-owned source keeps the breakpoint stop. A newer stop or resume invalidates
  the pending lookup so its delayed answer cannot resume a later breakpoint.
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
- js-debug launches cannot: all output of the tree arrives on the root connection and child sessions carry
  no `output` events at all. A js-debug child's `get_output` answers with an empty page and a note
  that its output is on the launch session (`outputOn: <launch session id>`); its resource reads
  the same way, preserving any diagnostics captured in the child's own buffer.
- js-debug attach roots do not own the process pipes. With the default console capture, each
  child's console output arrives on its own connection; its `get_output` and resource show those
  lines, without an `outputOn` pointer. This was measured with an attached Node parent and an
  adopted fork during the M2 review (js-debug v1.140.0).

The attribution is one per-adapter policy pin (below), applied to launch roots. The per-process-only
alternative (each session carries only its own process's lines) is not implementable for launches: js-debug offers no
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
- A js-debug program's exit ends every process under it: its unreported children within 300 ms
  (JavaScript spike, cascade row 2), and an adopted child too, even one paused on a breakpoint —
  its `terminated` arrives at the parent's exit, with no exit code (measured 2026-11-05 in M2's
  `javascript-subprocess-tree.test.ts`, js-debug v1.140.0). The launch owns the tree. The child's
  row goes `stopped` and stays listed until closed; the root ends normally with its own exit code.

### Closing

- `close_debug_session` on any session closes its subtree: descendants first (deepest first),
  then the named session. This applies to a child that has children of its own as well as to a
  root; closing a child leaves its ancestors and siblings open.
- Closing a **launch root** ends the whole process tree (Python spike, row 6; JavaScript spike,
  row 6: only the root's `disconnect` ends a js-debug tree, and it never answers, so the worker's
  timeout-then-tree-kill stays).
- Explicitly closing a **child** uses the adapter's measured child-close semantics for its selected
  subtree: debugpy terminates it (exit 0 reported to its parent, Python spike, row 4); js-debug
  cannot end a child it adopted and releases it to run undebugged (JavaScript spike, row 3). The
  named child's answer says which (`processEnded: true` / `released: true`). Closing a non-root
  subtree never shuts down the shared worker or adapter.
- Closing or idle-reaping an **attach root** preserves the external targets: every descendant is
  detached deepest-first with `disconnect(terminateDebuggee: false)` and the adapter's existing
  resume-before-detach policy, then the root is detached. All selected rows are removed and the
  answer says `released: true`. This cascade uses the initiating root operation's preserve-target
  policy, not the termination rule for an explicit child close above. It preserves today's worker
  auto-detach on attach-mode close (`handleTerminate` and `performShutdown` in
  `src/proxy/dap-proxy-worker.ts`). Worker/adapter cleanup must not escalate to killing the
  external targets.
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
names the hang goes with it) and the JavaScript launch transform defaults
`autoAttachChildProcesses` to `true`. The JavaScript attach transform defaults it on only for a
verified-local target: every attach form, including `processId`, checks that the inspector
target can read a temporary probe file created by the server and the installed js-debug
`bootloader.js` and `watchdog.js`. An unverified target defaults it off with a warning, because
injecting a server-local bootloader path can break its later forks. A loopback address or shared
PID namespace alone does not establish filesystem access. An explicit attach boolean is retained;
`true` requires the target and its children to be able to load the server's js-debug bootloader
and reach its debugger endpoint. The raw policy fallback stays off when no transformed or
explicit value is available. Adoption replaces #501's wedge guard for local targets; it cannot
make a host-only bootloader available remotely. An
explicit `false` in `dapLaunchArgs` turns adoption off for that launch and children run
undebugged, as they did before the tree (JavaScript attach uses
`adapterConfig: { autoAttachChildProcesses: false }`; Python attach uses the target's own flag,
measured below). Each flip ships in the milestone that
makes it safe (M1 for Python, M2 for js-debug), as a documented behaviour change with a `changed`
changelog entry, because it changes what a launch that spawns Python or Node processes shows:
child rows for every xdist worker, autoreloader child or script that shells out.

The Python **attach** transform flips in M1 only once its own measurement passes: the spike's
topology is a launch served by `python -m debugpy.adapter`, and whether a by-port attach's children
report on the same connection with the same `connect` body is unmeasured. M1 includes that
fixture; if it reports the same way, the attach default flips with the launch default, otherwise
attach keeps `subProcess: false` and its warning until a follow-up measures it.

Measured in M1's third PR (2026-11-04, `python-subprocess-attach.test.ts`): a by-port attach's
child is reported on the attach connection as a `startDebugging` request whose `connect.port` is
the port attached to, whatever the attach request's `subProcess` says (`true`, `false` and no key
alike: reported, adopted, stopped on the breakpoint); with the target started
`python -m debugpy --listen … --configure-subProcess false` there is no report at all. The target
decides at listen time, so the attach transform sends `subProcess: true` for the record, and an
attach's opt-out is the target's own flag (an explicit `false` in `adapterConfig` is forwarded with
a note saying so).

Two bounds keep that sane:

- A per-tree cap on live child sessions (`DEBUG_MCP_MAX_CHILD_SESSIONS`, default 32; `0` disables
  child-session adoption). It excludes js-debug's mandatory first target, which implements the
  root session and must still be adopted for launch to complete. Beyond the cap the release lever
  runs (the child runs undebugged) and the parent's next answer says so (`childrenReleased: n`).
  The count is never left unexplained (issue #1137): the cause of each release is recorded with it
  (`releasedChildCauses`: child sessions off, the cap, a proxy that cannot host children, a failed
  adoption), and every launch, restart and wait answer that carries the number ends its message
  with one sentence built from the same record (`describeReleasedChildren`,
  `src/session/execution/tree-settle.ts`): how many, that they run undebugged, why — naming
  `DEBUG_MCP_MAX_CHILD_SESSIONS` when it decided — and that a breakpoint only such a child reaches
  will not hit.
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
| ruby | debug gem 1.11.0 (rdbg) | **out of band**: with `fork_mode: both` (the default) the forked child runs `SESSION.activate on_fork: true` and opens its own debug server — the same TCP port with `RUBY_DEBUG_PORT_RANGE` unset (ten retries, then it raises), the next free port in the range otherwise — announced only by a `Debugger can attach via TCP/IP (host:port)` line on the child's stderr; nothing on the parent's DAP connection. A second reading of `server.rb` (2026-11-11) disagrees with that last clause: the TCP server's `accept` calls `super` first, which serves the inherited, already-connected socket (`@sock_for_fork`, `already_connected: true`) before it opens a listener of its own. Unmeasured either way; the [#1085](https://github.com/debugmcp/mcp-debugger/issues/1085) spike settles it | not needed: the child is not parked | the child's stderr reaches the launch session through the inherited pipe | `attach_to_process` by port against the child's own server (the adapter already connects to `rdbg --open` sockets directly), a new root | debug gem source read 2026-11-03: `lib/debug/session.rb` `__fork_setup_for_debugger`, `lib/debug/server.rb` `UI_TcpServer#accept`; Ruby on Windows has no `fork`, so a measurement needs Linux |
| rust, cpp, cobol | CodeLLDB / LLDB 22.1.8 | **follow**: `target.process.follow-fork-mode` is `parent` or `child` — the debugger keeps one process and releases the other; `stop-on-exec` is `true`; Linux and FreeBSD only; never an automatic report. Since CodeLLDB 1.12 the scripting API has `codelldb.start_debugging(request, configuration)` (the vendored `adapter/scripts/codelldb/api.py`), which makes the adapter send a `startDebugging` reverse request: a script-driven second session, unmeasured here | not applicable | not applicable | cpp and cobol: `attach_to_process` by pid, a new root; rust: no attach mode | setting values read from the vendored `lldb.exe` 2026-11-03 (`follow-fork-mode = parent`); [LLVM D100503](https://reviews.llvm.org/D100503) |
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
  unmeasured; `fork` does not exist on Windows, so the spike runs on Linux
  ([#1085](https://github.com/debugmcp/mcp-debugger/issues/1085)). It is a milestone only after that
  spike.
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
it hands each child's traffic to a **child proxy view** — an `IProxyManager` over the same IPC
channel, filtered to that child's id, with
`sendDapRequest` tagging the request with the id so the worker routes it to the right connection.

The session layer then needs nothing new per operation: a child is a `ManagedSession` whose
`proxyManager` is its view, wired with the same event handlers (`handleStopped`, `handleOutput`,
`handleTerminated`, …), its own `OutputRingBuffer`, its own breakpoint store and state machine. The
`InFlightGuard`, the pause coordinator, the stop anchor and the snapshot all work per session as
they do now. Terminal cleanup must be scoped to the connection: today's `handleTerminated`,
`handleExited` and `handleError` call `proxyManager.stop()`, which currently tears down the worker
and adapter. A child proxy view's `stop()` must instead close only that child's connection and
listeners, never delegate to the worker's process-level `stop()` or release its adapter slot. A
natural parent end likewise updates that session without reaping a worker that still serves live
descendants. The worker's terminal-event handlers and the root's session handlers must share this
lifetime rule; explicit root close still cascades, and final connection cleanup reaps the worker.
The tree-specific responsibilities in the core are:

- adoption: on the parent `ProxyManager`'s `child-reported` event, `SessionManager` creates the
  child session (`parentSessionId`, inherited language, the report's name), snapshots the parent's
  breakpoints into it, and tells the worker to adopt with that set (the hold before
  `configurationDone` is where they bind);
- the tree-aware wait: `waitForStop` subscribes to the state of the session and its descendants,
  including newly adopted descendants, and applies the four-rule priority above after each change;
- connection-scoped terminal cleanup, the cascade on close, and the per-tree cap.

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
- **end semantics**: what an explicit `close_debug_session` on a child does to the process
  (debugpy: terminates it; js-debug: releases it); an attach-root close/reap instead cascades its
  preserve-target policy through every descendant; whether the launch root's `disconnect` answers
  (js-debug: no);
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
| child exits while the parent is paused | child `terminated`; the parent, once continued, sees the exit and ends normally (row 1) | same (row 1) | the child row goes `stopped`; the parent's wait still reports the paused parent (rule 1), with the ended child in `children`; after the parent resumes, the child's end alone does not complete that wait (rule 4) |
| parent exits with a child live | the parent's `exited` is held until the child ends (inherited stdout pipe, #993); the child stays debuggable (row 2) | the program's exit kills unreported children within 300 ms (row 2) and ends an adopted, paused child at the same moment — its `terminated` arrives with the parent's exit, no exit code (measured in M2) | Python: the parent row stays `running` and its wait reports the child; the child row carries `parentSessionId` of a parent that is gone when it finally ends. js-debug: the child row goes `stopped` with no exit code and the root ends with its own; every adopted child stays listed and follows its own terminal events |
| explicit `close_debug_session` on a child | `disconnect(terminateDebuggee: true)`: the child ends, exit 0 reported to the parent (row 4) | `disconnect` with either flag leaves the child running (row 3) | its descendants closed deepest-first, then the child; `processEnded: true` / `released: true`; ancestors, siblings and the shared worker stay open |
| `close_debug_session` on a launch root | `disconnect(terminateDebuggee: true)` on the root ends the tree (row 6) | only the root's `disconnect` ends the tree, and it never answers (row 6); `terminate` or `disconnect` on a program or child session leave the processes alive (rows 4–5) | children closed deepest-first, then the root; the worker's timeout-then-tree-kill stays the backstop |
| close or idle expiry of an attach root | `disconnect(terminateDebuggee: false)` releases each child (row 3) | each child keeps running (row 3) | detach descendants deepest-first, then the root; preserve external targets and remove the tree's rows; `released: true`; no target-killing escalation |
| `detach_from_process` on an attach root with children | each child's `disconnect(terminateDebuggee: false)` resumes it undebugged (row 3) | each child keeps running (row 3) | children detached deepest-first (`released: true`), then the parent; the parent-side order with several children is measured by the M1 suite |
| `restart_debugging` on a parent | the relaunch ends the previous run's processes (row 6) | same (row 6) | the previous run's children are closed and removed; `childrenClosed: n` |
| grandchildren | reported on the child's connection, adopted there, `terminated` cascades bottom-up (row 7) | same (row 7) | `parentSessionId` = the child; the cap counts the whole tree |
| the HTTP client's MCP session ends (stale, stream lost, `DELETE /mcp`) | — | — | that client's SDK Server facade closes; its debug sessions, trees included, live on in the one core until they are closed, their program ends, or the server exits — or, where the operator set it, until the idle policy closes them (`MCP_DEBUG_SESSION_IDLE_MS`, off by default; #1025 step 2) |
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

1. `list_debug_sessions` is the whole process's list, in every era; the session `name` is the
   agent's own namespace hint. Several agents against one `http` process see each other's sessions:
   that is a single-tenant statement, and one server process per agent is the isolation, as stdio
   and the dev proxy already give. The legacy era's per-client server and foreign-session refusal
   ([#939](https://github.com/debugmcp/mcp-debugger/issues/939)) were that era's behaviour, not a
   contract, and went with the one-core-per-process change (shipped 2026-11, #1025 step 2). The
   seam for real isolation is in place: a session is created in its caller's scope — the
   authenticated principal when the request carried one, otherwise the shared anonymous scope —
   and a session outside the caller's scope does not exist for that caller: the dispatch hides it
   from the call's lookups, so every tool answers it exactly as it answers an id nobody holds
   (pinned tool by tool in `owner-scope-contract.test.ts`, for another principal and for an
   anonymous caller); with no authentication every caller is anonymous. Two things the seam does
   **not** scope yet, both acceptance criteria of the authenticated-`http` issue: a 2026-07-28
   `subscriptions/listen` (the SDK's entry serves it and publishes by URI, with no hook that sees
   the listener — and its acknowledgement echoes the filter it honoured, so dropping a foreign URI
   at request time would itself tell it from an unknown one), which lets a caller who already
   holds a foreign session's id learn that it exists and when it prints; and `GET /health`, which
   lists every debug session to whoever can reach the port.
2. Lifetime without an MCP session: a debug session ends by its own close, its program ending, or
   the server exiting. A **per-debug-session idle policy** exists and is **off by default on every
   transport** (decided with JF 2026-11-10, replacing the thirty-minute `http` default this section
   first carried: a sessionless client gives the server no sign of life between its calls, so any
   finite default ends some live agent's program, while a leaked session is visible in
   `list_debug_sessions` and closable by anyone). An operator of a shared or long-lived server
   turns it on with `MCP_DEBUG_SESSION_IDLE_MS`; the sweep runs every
   `MCP_DEBUG_SESSION_IDLE_SWEEP_MS` (60 s). When it is on, a session's row shows `expiresInMs`,
   and a later call naming a session the policy closed answers what happened, in its owner's scope.
   Only roots have a clock: a tool call naming any session in a tree refreshes the tree's root, and
   a child never expires on a clock of its own — the tree goes with its root (decided 2026-11-09,
   amending the per-descendant clocks this section first proposed: a worker paused under a parent
   the agent is driving must not be terminated by a timer). A tool call in flight holds the root for
   as long as it runs, whatever the tool, and the clock restarts when it answers (issue #1127:
   the hold was `wait_for_stop`'s alone at first, and a launch slower than the window had its
   session closed underneath it; `create_debug_session` with an attach target names no session
   and holds the one it creates around its inline attach); a call that arrives while the sweep is
   closing its tree waits for that close and is told what happened. The sweep is skipped entirely while a client is attending the
   process — any open legacy SSE stream or modern `subscriptions/listen` stream — so a connected
   client never loses a paused session to the clock; idle time still accrues from the last tool
   call, so a vanished client's already-idle sessions end at the first unattended sweep. Expiry
   cascades using the initiating operation's close policy above: idle expiry of an attach root
   releases all of its external targets. Explicit close and debuggee exit end a session sooner, as
   today.

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
set before launch; xdist workers; grandchildren; the cascade rows). Include closing a child with
grandchildren without orphaning their sessions, child termination without stopping the shared
worker or siblings, active-child calls preventing ancestor idle expiry, and an in-flight tree wait
protecting its descendants. The attach fixture must also show that root close and root idle expiry
release the whole subtree without killing external targets; explicit detach retains its stopped
rows, while close removes them. Seams: `src/proxy/minimal-dap.ts`
(reverse requests, event tagging), `src/proxy/dap-proxy-connection-manager.ts` (`initialize`),
`src/proxy/dap-proxy-worker.ts` (connection map, routing, shutdown), `src/proxy/proxy-manager.ts`
(demultiplexing), `src/session/session-store.ts` and `packages/shared/src/models/index.ts`
(`parentSessionId`), `src/session/session-manager-core.ts` (adoption, cascade),
`src/session/execution/execution-controller.ts` (the wait), `src/server/handlers/session-tools.ts`
(rows), `packages/shared/src/interfaces/adapter-policy*.ts` (the contract),
`packages/adapter-python/src/python-debug-adapter.ts` (the default).

**M2 — js-debug N targets ([#1082](https://github.com/debugmcp/mcp-debugger/issues/1082)), done.** `ChildSessionManager`'s single-child gate became the per-tree cap;
every report after the program's own becomes a child session; grandchild reports on child
connections are adopted instead of released; #501's throwaway attach stays the release lever and
the only one (PR 1, [#1094](https://github.com/debugmcp/mcp-debugger/pull/1094)).
`autoAttachChildProcesses` defaults on for launch and verified-local attach with a `changed` entry (the
`attach_to_process` schema text changed with it); the attach smoke
([`tests/e2e/mcp-server-smoke-javascript-attach.test.ts`](../../tests/e2e/mcp-server-smoke-javascript-attach.test.ts))
expects local adoption by default and untouched forks on opt-out; the attach suite
(`javascript-subprocess-attach.test.ts`: the designed flow over `node --inspect`, detach and close as
releases, the opt-out, #501's wedge guard) and the cascade suite (`javascript-subprocess-cascade.test.ts`:
row 1, a sibling's close as a release, a cluster primary's four workers) ride beside the fork/grandchild
suite of PR 1, which also verified that cap `0` still adopts the program's own target but releases
forks and measured parent exit with an already adopted, paused child (the child ends with the parent,
lifecycle row 2). Measured in PR 2: an attach root's children keep their own console output (no
`outputOn`; the attach owns no pipes), and `cluster.fork()` workers are reported like any fork.
Unblocks #985 M2 (jest and vitest workers as sessions).

**M3 — browser targets.** After the [#989](https://github.com/debugmcp/mcp-debugger/issues/989)
spike: the same mechanism, one session per page, frame and worker; the attach-addressing form is
new (CDP URL or port) and goes through the attach contract.

**Conditional — rdbg forks ([#1085](https://github.com/debugmcp/mcp-debugger/issues/1085)).** Gated on a Linux spike of the debug gem's fork behaviour under
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
  child-session adoption, excluding js-debug's mandatory first target.
- The idle policy knob is named `MCP_DEBUG_SESSION_IDLE_MS` (sweep: `MCP_DEBUG_SESSION_IDLE_SWEEP_MS`); it is off unless set (decided with JF, 2026-11-10).
- Only roots have an idle clock: activity on any session in a tree refreshes its root, a child never
  expires alone, a call in flight holds the root for as long as it runs (the tree-aware wait at
  first, every tool that names a session since issue #1127), and the sweep is skipped while a
  client attends the process (decided with JF, 2026-11-09).
- The ordering rule for several settles before one wait (parent first, then adoption order).
- Ended children stay listed until closed, and leave with their parent.
- Closing any session closes its subtree, including when that session is itself a child.
- A close/reap cascade uses the initiating root operation's ownership policy: an attach root
  releases every descendant; explicit detach retains stopped rows, while close removes them.
- The answer field names: `sessionId`, `children`, `outputOn`, `processEnded`, `released`,
  `childrenReleased`.
- The launch-shaped tools refuse a child id by name rather than operating on its parent, and so
  does `expose_session` (the mirror follows the root; a per-connection mirror is a follow-up).
- The wait stays level-triggered with the four-rule priority above: no settle log, no cursors.
- Detach cascades as a detach (children released); restart closes and removes the previous run's
  children; neither classifies children as `error`.
- The Python attach default flips in M1 only on its own measurement; the js-debug attach default
  flips in M2 for targets with verified access to the server's temporary and debugger files,
  together with the launch default. Unverified targets retain the safe off default unless the
  caller explicitly opts in.

## Left to the builder

- The IPC request routing: whether a child's requests travel in the existing `dap` command with the
  session id set, or a new command; the worker's per-connection request queue.
- How the child proxy view implements `IProxyManager`'s members: `stop` is connection-scoped as
  required above; process-level reads such as pid may delegate, and `isRunning` must account for
  the child's own connection as well as the shared worker's lifetime.
- Whether the tree-aware wait is a second `waitForSessionState` over a set of ids or a subscription
  on the parent's descendants; it must keep the microtask re-check that hides auto-continued entry
  stops ([#849](https://github.com/debugmcp/mcp-debugger/issues/849)).
- The regression suite's fixtures (settled in M1's third PR): `tests/fixtures/python/subprocess-tree/`
  — `parent.py`/`child.py`, `child_grand.py`/`grandchild.py`, `parent_exits.py`, `parent_two.py`,
  `mp_parent.py`, `attach_parent.py` — under
  `tests/adapters/python/integration/python-subprocess-{tree,cascade,attach}.test.ts` and
  `python-pytest-xdist.test.ts`.
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
