# The session state machine: the transition table and its shadow check

A debug session's public state (`SessionState`: created, initializing, running, paused,
stopped, error) is written in one place, the gate `SessionManagerCore._updateSessionState`
in [`session-manager-core.ts`](../../src/session/session-manager-core.ts). Every call of the
gate names the **site** it is made from and the **event** that makes the transition. A table
says, for each event, which phases it may move a session from and to. Today the table only
observes: a shadow check beside the gate judges every write against it and records a
verdict. It refuses nothing, and the gate writes exactly what it wrote before, in the same
order. The later stages of this work, which remove rows that describe today's behaviour and
then turn a refused transition into a refused command, are tracked in issue #1362.

The code is in [`src/session/machine/`](../../src/session/machine/):
[`transition-table.ts`](../../src/session/machine/transition-table.ts) holds the table, the
guards and the map of sites, and [`shadow.ts`](../../src/session/machine/shadow.ts) holds the
check.

## The table

A **phase** is a public state one to one (`created`, `starting`, `running`, `paused`,
`ended`, `failed`), except that `READY`, which is in the enum and never written, reads as
`starting`.

A **row** names an event, the phases it applies from, and where it takes the session (`to`:
a phase, or `same`). It also says whether the event is a request (a transition a command
makes, which a later stage may refuse before the command goes out) or an observation (an
event the engine reported, which is never refused, only recorded). A row may have:

- a **guard**: a condition on facts about the write. The row goes to `to` when the guard
  holds and to `otherwise` when it fails; with no `otherwise`, the row does not apply when the
  guard fails. For example, a refusal of a resume (`resume-refused`) rolls the session back to
  `paused` only if no `continued` event arrived since the request went out and the session is
  still at the stop the request started from.
- a **`legacy`** mark naming a later stage: the row describes a transition today's code makes
  and that stage removes. It is accepted until then and counted apart.
- a **`future`** mark naming a later stage: the row is that stage's shape for a transition no
  code makes today. It is data for that stage and is not in force: a write that only a future
  row lists is judged as having no row.

The stages a mark can name:

| Stage | What it changes |
|---|---|
| `stop-record` | One record per stop, stamped with a sequence number where the proxy receives it, which every answer reads; an event older than one already applied changes no phase. |
| `hidden-stop` | A stop the core resumes without showing it (an entry stop when `stopOnEntry` is off) never enters `paused`. |
| `endings` | Every ending of a run is one record, which collects the evidence of every terminal event that reaches it (the program's exit, `terminated`, the worker's exit). |
| `admission` | Which calls may run while another call or an ending is in flight on the session, and what a refused or unanswered request leaves behind. |

A legacy row is kept only for a transition a site writes by its own condition, from a phase
it reaches in ordinary operation. A phase a site reaches only after another defect (for
example, a step failure that leaves the proxy's event handlers attached, so that a later
`continued` writes `running` over `failed`) has no row: it is reported, not accepted. Every
`from` list names only the phases a site can be in when it writes.

## How a write is judged

The gate calls the shadow twice:

1. `begin`, just before it writes: it takes the facts the guards read (the stop the session
   records, the stop it last showed, how many `continued` events
   it has received, its run, its descendants). The gate's own state listeners run inside the
   write and may change the session; the verdict is about the write, so the facts are taken
   before them.
2. `check`, after the gate has done all of its work: it judges the phase the gate found, the
   event, and the phase it wrote, against the rows in force.

Each write gets one verdict:

| Verdict | Meaning |
|---|---|
| `legal` | A row in force lists the transition, and its guard (if any) held. |
| `legacy` | Only a legacy row lists it. |
| `guard-not-met` | A guarded row would list it only if its guard were the other way: the code made the transition the guard forbids, or skipped the one it requires. |
| `unevaluated` | A guarded row would list it, but a fact the guard needs is missing. This is never counted as legal. |
| `no-row` | No row in force lists it: no row for the event from that phase, or the rows there go elsewhere. A call that names no site or event, or an event its site does not name, is `no-row` too. |

Where today's code writes no state but the table has a row, the site calls `note` instead of
the gate. The notes are a hot restart of a running program, a `continued` that arrives while
paused, a run being replaced by a new launch or attach, the worker's exit after the session
already ended, and the one place that assigns the state directly (a refused step with no stop
recorded). A note is judged the same way and records where the table takes the session; when
the public state does not follow (a replaced run is `ended` in the table while its state is
still `running`), the next write is judged from where the table put it.

A few more outcomes are counted beside the verdicts: `test-setup` for the one mark a test may
pass when it calls the gate itself to set up a state; `lifecycle-agrees` and
`lifecycle-disagrees` for the writes of the derived lifecycle field, each checked against
what the state the gate wrote implies; and `internal-error` for a fault of the shadow itself,
which is swallowed in every mode.

Each mismatch (`guard-not-met`, `unevaluated`, `no-row`, a lifecycle disagreement, an internal
error) is one `[state-shadow]` line at `warn` in the server log and is kept in a bounded ring;
`legacy` is a `debug` line; `legal` is only counted.

## Modes

`MCP_STATE_SHADOW` selects the mode, read on every call:

- `record` (the default): verdicts are counted and mismatches logged; nothing is thrown.
- `strict` (the unit test project, set in `vitest.config.ts`): as `record`, and a `no-row` or
  a lifecycle disagreement also throws, after the gate has written. The code under test may
  swallow that throw, so the test harness (`tests/vitest.setup.ts`) registers itself in the
  process and the shadow queues each strict failure for it before anything else; the harness
  fails the test that left one, and a failure left after the last test fails the file. A test
  that provokes one on purpose claims it with `takeStrictFailures()`.
- `off`: nothing is checked.

Strict mode is **per process**. The queue lives in the process that made the write, and only a
harness in that process drains it: a child process (a server a test spawns, a nested test
runner) that swallows a strict throw is not seen by its parent's harness, and a process with
no harness queues nothing. The integration and end-to-end projects run in `record`.

`MCP_STATE_SHADOW_LOG=<directory>` writes the verdicts out: one ndjson line per verdict to
`state-shadow-<pid>.ndjson` in a process with no harness (a server), and one file of counts
and row matches per test file under the harness.

## Sites and the name `worker-exit`

`EVENT_OF_SITE` lists every site and the events it may name, and the compiler checks the
pairing at each call. Where a site can make more than one event it chooses from what it knows
at the write: a continue is the caller's (`resume`) or the core's own resume of a stop no
caller was shown (`resume-unseen`); a continue or a hot restart that fails was refused by the
adapter (`resume-refused`) or got no answer (`resume-unanswered`, a timeout or a cancellation,
after which the rollback to `paused` is a guess); a step call that throws before its step
landed is `resume-failed`, and one that throws after it (reading the answer) is
`answer-failed`, which has no row so that it is reported.

`worker-exit` names the channel, not the process: the proxy reports a worker's exit, a closed
adapter connection and the synthetic exit `ProxyManager.stop()` sends to its child views the
same way, and the sites cannot tell them apart until the endings stage records each as its
own observation.

## Adding a site, an event or a row

- **A site** (a new write of a session's state): call the gate with
  `{ site, event, facts? }`, or `note` where the code writes nothing, and add the site with
  its events to `EVENT_OF_SITE`. Add it to the expected list in
  `tests/unit/session/machine/shadow-sites.test.ts`, which reads every write in `src/session`
  with the TypeScript parser and fails on a write that names no site, a site it does not
  expect, or a second direct assignment of `.state`. Pass a guard's facts from the site (a
  resume's token from `stateShadow.token(session)`, taken before its request goes out).
- **An event**: add it to `SESSION_EVENTS`, then the rows it needs; an event with no row at
  all is always `no-row`, which is how a transition that must be reported is expressed.
- **A row**: give it a unique `id`; trim `from` to the phases a site can be in. Then:
  - `tests/unit/session/machine/transition-table.test.ts` checks every row in force both
    ways, every guard missing its facts, the exact list of (phase, event) pairs no row in
    force covers, the exact lists of `legacy` and `future` rows, and that no guarded row
    shares a target with an unguarded legacy row (that legacy row would hide the transition
    the guard exists to report);
  - `tests/core/unit/session/session-state-shadow-rows.test.ts` requires every row in force
    to be matched by a write the real session manager makes over the mock proxy. A row no
    code makes today is marked `future` instead.
