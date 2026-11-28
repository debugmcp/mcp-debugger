# mcp-debugger Tool Reference

This document provides a complete reference for all tools available in mcp-debugger.

## Table of Contents

1. [Session Management](#session-management)
   - [create_debug_session](#create_debug_session)
   - [list_debug_sessions](#list_debug_sessions)
   - [close_debug_session](#close_debug_session)
2. [Breakpoint Management](#breakpoint-management)
   - [set_breakpoint](#set_breakpoint)
   - [list_breakpoints](#list_breakpoints)
   - [remove_breakpoint](#remove_breakpoint)
   - [clear_breakpoints](#clear_breakpoints)
3. [Execution Control](#execution-control)
   - [The stop snapshot](#the-stop-snapshot)
   - [start_debugging](#start_debugging)
   - [restart_debugging](#restart_debugging)
   - [step_over](#step_over)
   - [step_into](#step_into)
   - [step_out](#step_out)
   - [continue_execution](#continue_execution)
   - [wait_for_stop](#wait_for_stop)
   - [pause_execution](#pause_execution)
4. [State Inspection](#state-inspection)
   - [Secret redaction](#secret-redaction)
   - [Least-privilege mode](#least-privilege-mode)
   - [get_stack_trace](#get_stack_trace)
   - [get_scopes](#get_scopes)
   - [get_variables](#get_variables)
   - [get_local_variables](#get_local_variables)
   - [evaluate_expression](#evaluate_expression)
   - [get_source_context](#get_source_context)
   - [get_output](#get_output)
5. [Additional Tools](#additional-tools)
   - [list_supported_languages](#list_supported_languages)
   - [attach_to_process](#attach_to_process)
   - [detach_from_process](#detach_from_process)
   - [list_threads](#list_threads)
6. [IDE Mirror](#ide-mirror)
   - [expose_session](#expose_session)
   - [unexpose_session](#unexpose_session)
7. [Language-Specific Tools](#language-specific-tools)
   - [hot_reload](#hot_reload)

---

## Session Management

### create_debug_session

Creates a new debugging session.

**Parameters:**
- `language` (string, required): The programming language to debug. Languages are discovered dynamically from installed adapters. The default fallback languages (when dynamic discovery is unavailable) are `"python"` and `"mock"`. When all adapters are available, the full list is: `"python"`, `"ruby"`, `"javascript"`, `"rust"`, `"go"`, `"java"`, `"dotnet"`, `"cpp"`, `"cobol"`, `"dart"`, `"mock"`. The actual list depends on which `@debugmcp/adapter-*` packages are discoverable at runtime. A language may be usable in one mode only — e.g. in the Docker container Ruby is attach-only (the adapter ships without a Ruby runtime; attach connects directly to a remote rdbg socket). Check `list_supported_languages` `modes` for per-mode availability; creating a session for an attach-only language is allowed, and only `start_debugging` will fail.
- `name` (string, optional): A descriptive name for the debug session. Defaults to `"<language>-debug-<timestamp>"` (e.g., `"python-debug-1711500000000"`), built from the session language and `Date.now()`.
- `executablePath` (string, optional): Path to the language interpreter/executable (e.g., Python interpreter path).
- `host` (string, optional): Attach mode only — host to attach to; the adapter defaults it (`127.0.0.1` for every adapter but Java, which uses `localhost`). Does not trigger attach mode by itself.
- `port` (number, optional): Debug port to attach to. **Passing `port`, `processId` or an `adapterConfig` that names a target — a debugger URI (`vmServiceUri`, `websocketAddress`, `vmServiceInfoFile`), or a Flutter `deviceId` for an app running on an Android device — switches the call into attach mode** — the session is created and immediately attached with the same request `attach_to_process` would send (see [attach_to_process](#attach_to_process) for the full attach contract; issue #905). `host` alone does not trigger it.
- `processId` (number or string, optional): Attach mode only — same as [attach_to_process](#attach_to_process)'s `processId`; triggers attach mode.
- `sourcePaths` (string[], optional): Attach mode only — same as `attach_to_process`.
- `justMyCode` (boolean, optional): Attach mode only — same as `attach_to_process`.
- `breakOnExceptions` (string, optional): Attach mode only — same as `attach_to_process` (no language default on attach). An invalid value is refused before the session is created.
- `stopOnEntry` (boolean, optional): Attach mode only — same semantics as [attach_to_process](#attach_to_process)'s `stopOnEntry`: **omitting it pauses the target after attach** (the pause may land after the response, reported as `pending: true` and named in `message`); pass `false` to attach to a live service without stopping it.
- `timeout` (number, optional): Attach mode only — connection timeout in milliseconds, forwarded as-is: js-debug honours it (its own default is 10 s) and COBOL uses it as its manifest-build budget; the other adapters ignore it. The shortcut no longer forces `30000`, which on js-debug out-waited the verify window. A value longer than `verifyTimeout` means the verify deadline is what you hit.
- `verifyTimeout` (number, optional): Attach mode only — how long to wait (ms) for the debugger to report at least one thread after attaching before failing the attach (default: `20000`, max: `600000`).
- `adapterConfig` (object, optional): Attach mode only — adapter-specific attach configuration merged into the attach config, with the same semantics as [attach_to_process](#attach_to_process)'s `adapterConfig`.

**Response:**
```json
{
  "success": true,
  "sessionId": "a4d1acc8-84a8-44fe-a13e-28628c5b33c7",
  "message": "Created python debug session: Test Debug Session"
}
```

**Example:**
```json
{
  "language": "python",
  "name": "My Debug Session"
}
```

**Notes:**
- Session IDs are UUIDs in the format `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- Sessions start in `"created"` state
- **One debugger core per process; the id is the capability (issue #1025).** On Streamable HTTP every MCP client of a process sees the same debug sessions: `list_debug_sessions` is the whole process's list, and any client holding an id can drive or close that session — run one `http` process per agent where agents must not see each other's work. A debug session outlives the MCP session that created it, so a one-shot script that opens a fresh MCP session per call reaches the sessions its previous run created, and a client that reconnects can resume or close what it left behind. A session ends by `close_debug_session`, by its program ending, or with the server: nothing expires on a timer by default. An operator can turn on the **idle policy** (`MCP_DEBUG_SESSION_IDLE_MS`, off by default on every transport): a session tree that no tool call has named for that long is then closed through the normal close cascade (a launched program is ended, an attached one released), unless a client is attending the process — while any client holds a stream open (a 2025 session's SSE stream, a 2026-07-28 client's `subscriptions/listen` stream), nothing expires; a tool call in flight holds the tree it names, whatever the tool, and the window starts over when it answers (issue #1127); children never expire on a clock of their own. `list_debug_sessions` shows each session's `idleMs` and, with a policy on, `expiresInMs`; a later call naming a session the policy closed answers what happened, with `closedBy: "idle-policy"`. The server is built to scope sessions per principal once it verifies callers itself (no authenticated `http` mode ships yet; an authenticating reverse proxy does not identify callers to the server), so today every caller is in the one shared scope
- When `port`, `processId` or an `adapterConfig` URI/info-file key is provided in `create_debug_session`, the server performs an inline attach (creating the session and immediately attaching). The session exists before the addressing gate can refuse the form (a `port` on C/C++, say), so such a refusal answers `success: false` with a usable `sessionId`. The response then mirrors `attach_to_process`: alongside `sessionId` it carries `state`, the attach `data` payload, an optional `warning`, and — when a requested post-attach pause has not landed yet — `pending: true`, with `message` saying so (`…; post-attach pause pending — the target stops when it next executes code; call wait_for_stop to block until it does (pass stopOnEntry: false to attach without pausing)`)

---

### list_debug_sessions

Lists all active debugging sessions — the whole process's list, whichever MCP client created them (see the note under `create_debug_session`).

**Parameters:** None (empty object `{}`)

**Response:**
```json
{
  "success": true,
  "sessions": [
    {
      "id": "a4d1acc8-84a8-44fe-a13e-28628c5b33c7",
      "name": "Test Debug Session",
      "language": "python",
      "state": "created",
      "createdAt": "2025-06-11T04:53:14.762Z",
      "updatedAt": "2025-06-11T04:53:14.762Z",
      "idleMs": 4210
    }
  ],
  "count": 1
}
```

**Session States** (from `SessionState` enum):
- `"created"`: Session created but not started
- `"initializing"`: Debug session starting up
- `"ready"`: Session initialized and ready to start debugging
- `"running"`: Actively debugging (program executing)
- `"paused"`: Paused at breakpoint or step
- `"stopped"`: Session stopped (program terminated)
- `"error"`: Session encountered an error

**`lastStop`:** present while the session is `paused` (the stop it is at: `reason`, `threadId`, `timestamp`, the adapter's `description`/`text`, and `exceptionInfo` for exception stops) and after it reaches `stopped`/`error` (the last stop before it ended). A `running` session never carries one, so a poller that calls this after `continue_execution` or a step sees `state: "running"` with no stop record until the next stop lands — the record of the stop it just left is not repeated as if the program were still paused.

**`debuggerDisabled`:** present (`true`) while the current launch runs with the debugger off — `dapLaunchArgs.noDebug: true` on an adapter that honours it (see `start_debugging`) — and the launch is live (`initializing`, `running` or `paused`). Cleared by the next launch or attach, and by a `stopped` event only a live debugger produces: a breakpoint the adapter itself reports (or names in `hitBreakpointIds`), an exception stop, or an entry stop — not a pause, a step, or a `debugger;` statement js-debug relabels as a breakpoint. Omitted otherwise (issue #749).

Errored sessions include optional `diagnostics` with the current launch attempt's server-host `proxyLogPath` and remote-safe `proxyLogResource`. The record is retained for proxy initialization failures and for proxy/adapter deaths after initialization, and is cleared when a new launch or attach attempt begins.

**`idleMs`:** milliseconds since the last tool call naming this session, or any session in its tree, answered (a child reports its root's); `0` while such a call is still running — what tells a forgotten session from a live one. **`expiresInMs`:** present only when the operator turned the idle policy on (`MCP_DEBUG_SESSION_IDLE_MS`): how long the tree has before the policy closes it; any tool call naming the session resets it and holds it for as long as the call runs (a slow launch or a long `wait_for_stop` is never closed underneath itself, and the window starts over when it answers), and nothing expires while a client is attending the process.

**`parentSessionId`:** present on child rows only. A child session is created by the server, never by `create_debug_session`, when the adapter reports a process the debuggee started: a Python launch or attach — debugpy's sub-process debugging is on by default; `dapLaunchArgs: { subProcess: false }` opts a launch out and an attach target decides for itself with `--configure-subProcess` — where debugpy reports each child, or a JavaScript session — launches default `autoAttachChildProcesses` on; `dapLaunchArgs: { autoAttachChildProcesses: false }` opts a launch out, while an attach injects no bootloader into the target for future children by default; enabling `adapterConfig: { autoAttachChildProcesses: true }` on the attach makes later children load a file from this server through `NODE_OPTIONS` and wait at startup for the debugger; they can fail if the file is unavailable, start late if forks outpace attaches, or remain waiting if forked during detach (#1286) — where, with child auto-attach enabled, js-debug reports every Node process the program forks or spawns, `cluster` workers and grandchildren included (see [the session tree](./architecture/session-tree.md)). The child inherits the parent's `language`, its `name` is the adapter's own label for the process (debugpy: `Subprocess <pid>`; js-debug: `<script> [<pid>]`), it has its own breakpoints, `get_output` and `close_debug_session`, and it carries no `exitCode` (it ends with the adapter's `terminated` event). The parent's [`wait_for_stop`](#wait_for_stop) reports the child's stop with `sessionId` naming the child and `children` listing the tree; a child can still be waited on by its own id (that wait answers for the child and its own descendants only). `start_debugging`, `restart_debugging`, `attach_to_process`, `detach_from_process`, `expose_session` and `unexpose_session` refuse a child id by name. Closing the parent closes its children first (`childrenClosed` in the answer). `DEBUG_MCP_MAX_CHILD_SESSIONS` caps the live children of one tree (default 32; `0` turns adoption off): a child reported beyond the cap is released and runs undebugged, and the parent's next `wait_for_stop`, `start_debugging` or `restart_debugging` answer counts the run's released children in `childrenReleased`.

---

### close_debug_session

Closes an active debugging session.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session to close.

**Response:**
```json
{
  "success": true,
  "message": "Closed debug session: a4d1acc8-84a8-44fe-a13e-28628c5b33c7"
}
```

A session with child sessions, a child session or an attach root says what the close took with it
(the session tree, issue #1081):
```json
{ "success": true, "message": "Closed debug session: c7e2a9b4-5d1f-4e8a-9b3c-2f6d8a1e0b47", "processEnded": true }
```

- `childrenClosed: n` when the close took descendants with it: descendants are closed first,
  deepest first, then the named session. Closing a child leaves its ancestors, its siblings and the
  debug adapter they share alone.
- `processEnded: true` when the named session is a child whose process the close ended (debugpy: a
  child's close terminates it, exit 0 reported to its parent).
- `released: true` when the named session borrowed its program (an attach) and the debug adapter
  acknowledged the detach (issue #1148): its descendants are detached with their targets kept
  running, deepest first, their rows removed, then the root is detached. When the adapter did not
  acknowledge it within the worker's 1 s bound there is no `released`, and `warning` reads `The
  debug adapter did not confirm that it released the process (<why>); whether the process is still
  running is not known`; `processEnded: true` instead when the adapter reported that the program
  exited. A session whose program was already gone, or one that launched its program, carries none
  of the three. It used to be `released: true` for every attach root, whatever the adapter did. Also
  when the named session is a JavaScript child: js-debug cannot end a target it adopted, so the
  close disconnects with the process kept running and it finishes undebugged (a root's close
  releases its JavaScript children the same way, counted in `childrenClosed`).

**Notes:**
- Sessions may close automatically on errors
- Closing a non-existent session returns `success: false` (`message: "Failed to close debug session: <id>"`); a session another MCP client of the same process created closes like any other — the id is the capability (issue #1025)
- On a launch session the debuggee is terminated. Adapters that need a DAP `terminate` ahead of the
  disconnect to do so (the Dart and Flutter SDK adapters) receive one first (#885); an attached
  process is detached, not terminated

---

## Breakpoint Management

### set_breakpoint

Sets a breakpoint in a source file.

**Parameters:**

In the shipped default addressing mode (`content`), `sessionId` is the only parameter the schema marks required: address the breakpoint by `file` + `line`, by `file` + `statement`, or by `function` alone. Restricting the mode with `DEBUG_MCP_BP_ADDRESSING=line` (or `=assert`) removes `statement`, `nearLine` and `function` from the schema, and `file` + `line` become required.

- `sessionId` (string, required): The ID of the debug session.
- `file` (string): Path to the source file — **absolute** in host mode (a relative path is rejected with `Path must be absolute. Received: "..."`); in container mode paths are resolved against the `/workspace` mount, so a path relative to the mounted directory works there. For Java, a fully-qualified class name (e.g. `com.example.MyClass` or `com.example.Outer$Inner`) is preferred — it works reliably with every classloader. A path of the machine the server runs on reaches the debug adapter in that machine's own spelling, whichever way its slashes lean and whether the breakpoint is set before the launch or on a running session (issue #1147: on Windows `C:/proj/a.cs` is sent as `C:\proj\a.cs`; a live breakpoint used to go out as typed, and netcoredbg then answered `No symbols have been loaded for this document`). A path that is not absolute on that machine (the debuggee's own path in a remote attach) is sent exactly as given. The answer's `file` is the path the server recorded for the breakpoint (what you passed; in container mode, resolved against `/workspace`), whichever spelling went to the adapter, and `list_breakpoints` reports a `boundFile` only when the adapter bound it in a different file, not when it answered with another spelling of the same one.
- `line` (number): Line number where to set breakpoint (1-indexed).
- `statement` (string, optional): **Content addressing** — instead of `line`, pass the text of the target line, like an Edit-tool match — a distinctive substring is enough (leading/trailing whitespace and trailing `//`/`#` comments are ignored; an exact whole-line match always wins over substring matches). Can only land on a line containing your stated text — an inexact or multi-candidate match still sets the breakpoint but adds a `warning` to the response; if the text appears on multiple lines the error lists every match; anchors re-resolve across `restart_debugging` after file edits. Provide `statement` OR `line`, not both. See [Statement anchors](#statement-anchors).
- `function` (string, optional): **Symbol addressing** — break on entry to a function/method by name (DAP function breakpoint). Session-global: no `file` or `line` at all, and names survive edits better than both. Composes with `condition` only. Supported by Python, Go, Rust, C/C++, .NET, Java, JavaScript and COBOL (JavaScript names are dotted runtime paths delivered over the CDP bridge — see [Function breakpoints](#function-breakpoints); COBOL names are paragraphs, sections or a PROGRAM-ID, qualifiable as `1000-INIT OF PAYROLL`, resolved by the COBOL shim to the range's first statement); Dart/Flutter is rejected up front (the SDK debug adapters have no `setFunctionBreakpoints` request, so the Dart policy pins the capability off); Ruby is rejected up front (rdbg advertises the capability but its handler ignores the request, so nothing would ever bind).
- `nearLine` (number, optional): With `statement` only — when the statement text appears on multiple lines, bind to the match closest to this line (ties go to the lower line).
- `expectedContent` (string, optional): With `line` only — assert the text of the target line before setting; a distinctive substring is enough (leading/trailing whitespace, trailing `//`/`#` comments and the line's trailing `;` or `.` are ignored — a statement quoted without its terminator is a whole-line match, issue #1038). On a mismatch the breakpoint is **not** set and the error shows the actual content of that line and its neighbors — a fast, self-explanatory failure instead of a breakpoint that silently lands on the wrong line. A relaxed match (a partial substring, or one that only holds after ignoring text past a `//`/`#` marker) still sets the breakpoint but adds a `warning` quoting the actual line. See [Content assertions and loud snapping](#content-assertions-and-loud-snapping).
- `condition` (string, optional): Conditional expression — only break (or log) when it evaluates truthy.
- `logMessage` (string, optional): Create a **logpoint** instead of a pausing breakpoint — see [Logpoints](#logpoints) below.
- `suspendPolicy` (string, optional): Suspend policy when the breakpoint is hit — `"all"` suspends all threads (default), `"thread"` suspends only the event thread. Only supported by the Java/JDI adapter.

**Response:**
```json
{
  "success": true,
  "breakpointId": "28e06119-619e-43c0-b029-339cec2615df",
  "file": "C:\\path\\to\\debug-mcp-server\\examples\\python_simple_swap\\swap_vars.py",
  "line": 10,
  "verified": false,
  "message": "Breakpoint set at C:\\path\\to\\debug-mcp-server\\examples\\python_simple_swap\\swap_vars.py:10",
  "context": {
    "lineContent": "    a = b  # Bug: 'a' loses its original value here",
    "surrounding": [
      { "line": 8, "content": "    # Or Python's tuple assignment: a, b = b, a" },
      { "line": 9, "content": "    " },
      { "line": 10, "content": "    a = b  # Bug: 'a' loses its original value here" },
      { "line": 11, "content": "    b = a  # Bug: 'b' gets the new value of 'a' (which is original 'b')" },
      { "line": 12, "content": "    " }
    ]
  }
}
```

**Important Notes:**
- Breakpoints show `"verified": false` until debugging starts
- Works in every lifecycle state short of `close_debug_session`: before the first launch (queued, `verified: false`), while running or paused (sent live, with the adapter's answer in the response), and after the program has exited (queued for the next `start_debugging`/`restart_debugging`). A session that was attached keeps attach path semantics until its next launch (issue #806): a remote attach passes paths through verbatim with no `statement` anchors, while a local attach — by `processId` or to a loopback endpoint — resolves a path that exists on this host the way a launch does (issue #899)
- The response echoes the resolved path the server actually used — in container mode that is the path with the workspace prefix applied; for a remote attach session the path is passed through unchanged, and so is a local attach's path when the file is not on this host. On a remote attach the response carries no `content`/`context` (the host file is not the debuggee's source) and a `note` says so (issue #899)
- Setting breakpoints on non-executable lines (comments, blank lines, declarations) may cause unexpected behavior
- Executable lines that work well: assignments, function calls, conditionals, returns
- The top-level `content` field echoes the bound line's text (same as `context.lineContent`)
- The adapter's own words about the breakpoint are in `message`. `warning` repeats them only when the breakpoint did not bind (`verified: false`); a bind that succeeded describes itself in `message` alone, so a `warning` on a `set_breakpoint` answer always means something to act on (issue #1144). Examples of a clean bind's `message`: a COBOL paragraph's `2000-COMPUTE (paragraph of HELLO) -> hello.cob:42`, CodeLLDB's `Resolved locations: 1`.
- `content`, `context` and `line` come from the file you named. When the adapter binds that file through a compiled one and that compiled file is older than the source, the response adds a `warning`: "The compiled file the debugger binds this location through may be stale: `dist/x.js` (modified …) is older than `src/x.ts` (modified …)…" (issues #938, #950). Which compiled file depends on the language. A TypeScript source under js-debug binds through the generated `.js` and its `.js.map`: found from the nearest `tsconfig.json` that names an `outDir` (with its `rootDir`), or — when no tsconfig names one — the conventional `dist|build|out|lib` under the nearest `package.json`, a sibling `.js` last; only a candidate whose `.js.map` names the source counts, and a launch whose program is itself a `.ts` (tsx, ts-node, type stripping) or a runner under `node_modules` (vitest, jest, mocha) is exempt. A Java source binds through its `.class` under a `classpath` directory of the launch (at the package path mirroring the source's directory, or beside the source); a .NET source through the launched DLL (whose PDB carries the lines); a Go source in `exec` mode, and a Rust, C/C++ (headers included) or COBOL (copybooks included) source, through the executable the launch runs. For those compiled languages the artefact is known only once `start_debugging` has run: before that the echo stands alone; afterwards a `set_breakpoint` carries the `warning`, and every answer that names a stop carries the `note` — the `start_debugging` (or `restart_debugging`) answer itself when the program is already paused at a breakpoint when the launch answers, `wait_for_stop`, `step_*`, `pause_execution`, and `get_stack_trace` for the file of its top frame (issue #951) — so a fast program that stops as it starts is told in the one call. A COBOL `runner: "cobcrun"` launch, a COBOL source launch (cobc's build is keyed on the sources' content, so it is current by construction) and every attach session name no artefact, and a source under the toolchain (a system header, Rust's std, a registry crate) is not compared. When several class files could be the one (a leftover in-place compile beside the source and the build under `out/`), the newest existing one is compared — a stale leftover never outranks the build the engine loads. The check compares mtimes only, so it is a hedge, not a verdict (a file saved without changes reads as newer too, an incremental `tsc` does not re-emit for it, and a source beside the project that was never compiled into the artefact reads as stale). The same sentence appears as `note` on `start_debugging`, `restart_debugging`, `step_*`, `wait_for_stop` and `pause_execution` answers whose location is such a file, and on `get_stack_trace` when its top frame is in one

#### Content assertions and loud snapping

`expectedContent` is a checksum on intent: agents that compute line numbers from a code listing routinely land one line off, and a breakpoint on a blank line or brace produces confusing session behavior much later. With `expectedContent`, the mismatch fails at set time:

```
Breakpoint not set: line 12 of /abs/app.py does not match expectedContent.
Expected: "total = sum(prices)"
Actual:   "return total"
Context:
   10 |     prices = load()
   11 |     total = sum(prices)
>  12 |     return total
   13 |
   14 | def main():
The file may have changed since you last read it. Pick the correct line from the context above. Or address by content: set_breakpoint {statement: "total = sum(prices)"} — that text is on line 11.
```

The last sentence is the statement resolver's own answer for the expected text (issue #1142), so following it always works: on one line it names the line; on several it adds `nearLine` (the line you asked for) and lists them — `{statement: "print(a, b)", nearLine: 5} — that text is on lines 4 and 6; nearLine picks the closest (line 4).`; when the resolver would not find the text — it is absent, or it is only where statement matching does not look (a comment line, or past a `//` or `#` on a line) — no statement is offered, and the sentence instead names the lines this same `expectedContent` would pass on (`That expectedContent matches line 12.`) or says `That expectedContent matches no line of the file.`; and text spanning lines gets no such sentence. It is only added where statement anchors are available (`DEBUG_MCP_BP_ADDRESSING=content`, the default).

**A breakpoint request under a pending JavaScript pause is held** (issue #1146). While a pause is pending on a JavaScript session — `pause_execution` or `attach_to_process` answered `pending: true`, which now takes a program its wake timer cannot reach — `set_breakpoint`, `remove_breakpoint` and `clear_breakpoints` update the session's breakpoints but send nothing to the adapter: a new breakpoint answers `verified: false` with `warning: "Held: a pause is pending on this session, so this breakpoint request is sent when the program stops. …"`. The held requests go out when the program next stops (the pending pause landing counts), one at a time and ahead of any breakpoint request that arrives meanwhile, and a `continue_execution` or a step that follows the stop waits for them (with nothing held, breakpoint requests are sent as they arrive, as on any other session); `list_breakpoints` then shows the adapter's answer. The reason: js-debug sets a breakpoint by running code of its own in the program, and a pending pause fires inside that code, where it is lost or freezes the program. Separately, when js-debug's target session does not answer a breakpoint request within 3 s, `warning` says its answer is still outstanding; the breakpoint's own `message` is then still the parent session's provisional `Unbound breakpoint`. A late answer to that request is not read; if the target binds the breakpoint, the `breakpoint` event it sends is what turns `list_breakpoints` to `verified`.

Relatedly, when a debug adapter *accepts* a breakpoint but binds it to a different line (adapters snap requests on non-executable lines to the nearest valid one), the response reports it prominently instead of silently mutating the line: `message` and `warning` carry `"requested line 12, bound to line 13: \`...\`"`, and the response includes `requestedLine` alongside the bound `line`. Adapters that relocate breakpoints asynchronously (after the response) surface the move in `list_breakpoints`, where `line` ≠ `requestedLine` marks a snapped breakpoint.

`expectedContent` is checked against readable launch and local-attach files — an attach by `processId` or to a loopback endpoint whose file exists and can be read on this host (issue #899). On a remote attach, an attach whose target host is not known, a local attach whose path is not usable on this host, or a Java FQCN source identifier, the breakpoint is requested at `file:line` by line addressing and `warning` states that `expectedContent` was not checked and why, leaving binding status to `verified`, `line`, `boundFile` and `message` (issue #1326); a launch or local-attach file that exists on this host but cannot be read (binary, empty, too large, or unreadable) is still refused. Both addressing aids can be restricted with the `DEBUG_MCP_BP_ADDRESSING` environment variable (`line` = pre-existing behavior, `assert` = + expectedContent/loud snapping, `content` = all features; default `content`) — useful for controlled comparisons of agent behavior.

#### Statement anchors

`statement` addresses a breakpoint by content instead of line number — the single most practiced agent skill (Edit-tool `old_string` matching) instead of line arithmetic:

```json
{ "sessionId": "...", "file": "/abs/app.py", "statement": "total = sum(prices)" }
```

- **Matching**: whole-line equality after trimming leading/trailing whitespace; when no exact match exists anywhere, a substring match against comment-stripped lines is accepted (exact matches always win — the two populations never mix). Multi-line input is rejected — anchor on the first line of a multi-line construct.
- **Ambiguity is an error, and the error is the disambiguation UI**: every matching `line: content` pair is listed (capped at 20); add `nearLine` to bind to the closest match. A `nearLine` pick among multiple matches adds a `warning` naming every candidate line — proximity is a heuristic, not a guarantee.
- **Blank/comment anchors are rejected** (`#`, `//`, `/*` prefixes) — debuggers cannot break there reliably.
- **The anchor is stored on the breakpoint record** (visible in `list_breakpoints`) and **re-resolves on `restart_debugging`**: after you edit the file — the whole point of a debug session — the relaunch re-finds each anchored statement in the current file (the breakpoint's previous line breaks ties between duplicates). Moves are reported in the restart response's `data.anchorResolution.moved` — a move picked among multiple matching lines carries a `candidates` list and a restart `warning`; anchors that no longer match keep their previous line and warn (`data.anchorResolution.stale`) rather than failing the restart or dropping state.
- Same readable-file requirement as `expectedContent` (checked on launches and on attaches by `processId` or to a loopback `host`/`port` whose file exists and can be read on the mcp-debugger host, issue #899; Java FQCNs, remote or unknown-host attach sessions, and local attaches whose path is not usable on this host have no fallback `line` and return `{success: false, error, state}` naming `file` and `line` — and telling the caller to omit `nearLine` too when passed — issue #1326); composes with `condition`, `logMessage`, and `suspendPolicy` unchanged.
- A matching `expectedContent` alongside `statement` is accepted as redundant (matching under the same relaxed rules: trailing comments ignored, either value may be a substring of the other); a genuinely *different* one is an error (contradictory intent).

#### Function breakpoints

`set_breakpoint {sessionId, function: "process_order", condition?}` breaks on entry to a symbol, with no file or line:

- Session-global, name-addressed — the adapter resolves the symbol across the whole program, and the name survives any file edit. `restart_debugging` re-applies them natively.
- Composes with `condition` only (`logMessage` and `suspendPolicy` have no DAP function-breakpoint form; file/line/statement/expectedContent are contradictory and rejected).
- The response and `list_breakpoints` report the adapter's bound location as `boundFile`/`boundLine` once verified. `list_breakpoints` returns function breakpoints in a separate `functionBreakpoints` array (excluded when filtering by file); `remove_breakpoint` accepts `function: "name"` or the breakpoint id; an unscoped `clear_breakpoints` removes them, a file-scoped clear does not.
- Support is adapter-gated: Python, Go, Rust, C/C++, .NET, Java, JavaScript and COBOL (paragraph, section and PROGRAM-ID names) work; Ruby is rejected up front — rdbg's initialize response advertises `supportsFunctionBreakpoints`, but the debug gem's DAP handler acknowledges the request and ignores it (verified against debug 1.11.0), so the Ruby policy pins the capability off rather than trust the advertisement. Dart/Flutter is rejected up front too: the SDK debug adapters have no `setFunctionBreakpoints` at all (the request answers `Unknown command`), so the Dart policy pins the capability off.
- **A name that never binds is reported, not silent**: known-hazard names warn at set time (Go's bare identifiers need package qualification — `main.main`; a bare `main` on Rust resolves to the C runtime's entry point, use `my_crate::main`); function breakpoints still unbound after launch produce a `warning` in the `start_debugging` response (suppressed for JavaScript/Java, which bind late by design); and breakpoints that never bound by program exit get an explanatory `message` in `list_breakpoints` plus a `[mcp-debugger] Warning:` entry in `get_output`.
- Java names may be bare (`helper`), class-qualified (`Foo.helper`, `com.example.Foo.helper`, `Outer.Inner.helper`), or constructors (`Foo.<init>`). Every concrete overload binds (the reported `boundLine` is the first); classes not yet loaded bind on load and report through breakpoint events. Bare names skip JDK-internal classes (`java.*`, `javax.*`, `sun.*`, `jdk.*`, `com.sun.*`) — qualify the class to target those.
- **JavaScript semantics differ by design** (js-debug implements no DAP function breakpoints upstream — vscode-js-debug#952 — so ours are delivered over js-debug's CDP proxy via V8's `Debugger.setBreakpointOnFunctionCall`, the same primitive behind Chrome DevTools' `debug(fn)`). The name is a **dotted runtime path** (`handler`, `obj.method`, `globalThis.tick`), resolved side-effect-free against the top paused frame's scope (or global scope while running) and **bound to the function value it resolves to at that moment** — it is *not* a source-symbol search ("all functions named X" is not the contract), and reassigning the property later does not move the breakpoint. Top-level `function` declarations of the main module bind at launch; `const fn = ...` and functions in lazily-loaded modules stay `verified: false` with an explanatory message and bind automatically at the next pause. Names resolve against runtime names, not TypeScript/minified source names. Launch and attach modes both work (attach has no entry pause, so module-scoped names bind at the first pause after attach).

#### Logpoints

Passing `logMessage` turns the breakpoint into a DAP logpoint: when the line is hit the program does **not** pause — the message is logged and execution continues. Expressions in `{curly braces}` are interpolated with live values (e.g. `"order={orderId} total={total}"`), and the messages arrive in the session output, readable via [`get_output`](#get_output) and the `debug://sessions/{id}/output` resource. `condition` may be combined with `logMessage` — the message is only logged when the condition holds. In a session tree the message is on the session of the process that hit the logpoint: a child process's lines are read with `get_output` on the child's id, and `get_output` on the parent lists its children.

**What a logpoint costs.** A logpoint never pauses the program (no stop is reported and the session stays `running`), and in the measurement below, having the debugger attached with nothing set added no measurable overhead (0 to 3%). It is still not free. There are three costs to weigh before pointing one at a live service:

1. **An attached debugger and, for Python, JavaScript and Dart, an open debug port.** A logpoint is delivered by a debugger that stays attached for as long as you watch. To watch a process that is already running, the debugger has to get in. For Python, JavaScript and Dart that is through a debug listener in the process (debugpy's `--listen` port, Node's inspector, the Dart VM service), which the operator usually opened when starting it and which is theirs to secure; C/C++ and COBOL processes are attached by process id through the operating system, with no listener. One listener is mcp-debugger's own doing: `attach_to_process { processId }` on a Node.js process makes Node open its inspector, on `127.0.0.1:9229` unless the process was started with `--inspect-port`, and that inspector **stays open after `detach_from_process` and `close_debug_session`**, until something inside the process closes it or the process exits ([#1261](https://github.com/debugmcp/mcp-debugger/issues/1261)). It has no authentication: any local process can connect to it and run code in the target. The [JavaScript guide](javascript/README.md#attaching-to-a-running-nodejs-process) describes one tested way to close it.
2. **Time per hit.** Every hit costs the program time, and how much depends on the engine: the table's *Cost of one logpoint hit* column.
3. **A slower function for as long as it holds a breakpoint.** In Python, JavaScript and Dart a line breakpoint of any kind (plain, conditional or a logpoint) slows the whole function it is in, even when its own line never runs: the table's last column, explained under the table. The native engines (Go, Rust, C/C++, COBOL) show no measurable effect outside the line.

| Adapter | Cost of one logpoint hit | False-condition breakpoint on the line | Logpoint elsewhere in the same function |
|---|---|---|---|
| Python | 24.7 µs | 5.5 µs | whole function runs 58× slower |
| JavaScript | 215 µs | 52 µs | whole function runs 2.57× slower |
| Go | 615 µs | 278 µs | no measurable effect (0.98×) |
| Rust | 635 µs | 544 µs | no measurable effect (0.99×) |
| C/C++ | 639 µs | 560 µs | no measurable effect (1.01×) |
| COBOL | 1,687 µs (1.7 ms) | 614 µs | no measurable effect (1.00×) |
| Dart | 4,926 µs (4.9 ms) | 4,868 µs (4.9 ms) | whole function runs 1.70× slower |

*Measured 2026-11-26 on mcp-debugger `ff291452` (`main`), Windows 11 Pro (Intel Core Ultra 9 285H), launch mode, debug builds, default server log level (`info`), medians over 5 runs (Python 3.13.12 + debugpy 1.8.20 `sys.monitoring` path; Node 24.14.1 + js-debug 1.140.0; Go 1.26.1 + Delve 1.26.3; Rust 1.94.1 GNU + CodeLLDB 1.12.3; g++ 15.2.0 MinGW + CodeLLDB 1.12.3; GnuCOBOL 3.2 + CodeLLDB 1.12.3 behind the adapter shim; Dart SDK 3.13.4). Not measured: Linux, optimized builds, Python's pre-3.12 tracing path, whether a hit stalls other threads in a multi-threaded program, and how much of Python's 24.7 µs comes from pydevd's debug logging (`DEBUGPY_LOG_DIR`). Attach mode is covered only by the check below.*

*Checked 2026-11-27 on the published mcp-debugger 0.27.0 and the same machine, on battery power this time (the table's power state was not recorded), for JavaScript and Python only, in launch mode and in attach mode (a `--inspect` port; a `debugpy --listen` port), four runs per configuration, with a different loop from the table's: first a logpoint on a line that never runs, then a logpoint hit 200 times in a burst with the message `h={i}`. Whole-function slowdown: JavaScript 7.5× to 8.8× launched and 4.8× to 8.4× attached; Python 26× to 59× launched and 25× to 49× attached. Per hit: JavaScript 0.40 to 0.43 ms launched and 0.37 to 0.47 ms attached; Python 41 to 72 µs launched and 14 to 25 µs attached. So in this check, attached by port, the whole-function slowdown was about the same as in launch mode on the same loop, and a hit cost about the same attached as launched in JavaScript and less in Python. The check is too coarse to confirm or refute the table's 0 to 3% for a debugger attached with nothing set. The figures also differ from the table's by up to about three and a half times (another loop, another message, a burst of hits, battery power, and a spread of about two between runs on this machine): read the table as the order of magnitude, not as constants.*

**Why the whole function slows down, and when it recovers.** The causes are read from each engine's source at the measured version, where they apply to any line breakpoint; the slowdowns are measured with logpoints.

- **JavaScript.** V8 de-optimizes a function when a breakpoint is set in it: it throws away the function's optimized and baseline code (`Debug::PrepareFunctionForDebugExecution` calling `Debug::DeoptimizeFunction`, `deps/v8/src/debug/debug.cc` in Node v24.14.1) and does not optimize it again while the breakpoint is there (`GetOrCompileOptimized` in `deps/v8/src/codegen/compiler.cc`: "Do not optimize if we need to be able to set break points"). What the function loses is what optimization had gained it, so the figure depends on the function: 2.57× on the table's loop, about 8× on the tighter arithmetic loop of the check above.
- **Dart.** The VM does not optimize a function that has a breakpoint (`Compiler::CanOptimizeFunction` in `runtime/vm/compiler/jit/compiler.cc`, SDK 3.13.4: "We cannot set breakpoints and single step in optimized code, so do not optimize the function"). 1.70× on the table's loop.
- **Python 3.12 and later.** debugpy switches on line events for the whole function (`_enable_line_tracing` in pydevd's `_pydevd_sys_monitoring.py`, debugpy 1.8.20), and its line handler keeps them on for as long as the function has a line breakpoint, so every line the function executes calls into the debugger. CPython also runs the first instruction of each such line without its specialization while line events are on (`instrument_line` in `Python/instrumentation.c` and the `INSTRUMENTED_LINE` case in `Python/ceval.c`, CPython 3.13.12). How much of the slowdown each of the two explains was not measured. 58× on the table's loop, 25× to 59× in the check above.
- **Recovery.** In the check above, after `remove_breakpoint` Python's first recorded call of the function and JavaScript's second were back in the range of its time without the logpoint; the first recorded call could include one already in flight when the logpoint was removed. After `detach_from_process` with the logpoint still set, the first recorded call was back in that range in both languages, and the program kept running. Dart's recovery was not checked.

In practice, a logpoint suits a line hit up to some hundreds or thousands of times a second, not a tight loop, and in Python, JavaScript and Dart a function that is not itself hot:

- **Maximum hit rate doing nothing else** (and cost at 1,000 hits/s): Python about 40,000 hits/s (2.5% of a core at 1,000 hits/s); JavaScript about 4,600 hits/s (22% of a core); Go, Rust, and C/C++ about 1,600 hits/s (62–64% of a core); COBOL about 590 hits/s (1.7 s per 1,000 hits); Dart about 200 hits/s (4.9 s per 1,000 hits).
- **Whole-function slowdown:** in Python (58×) and JavaScript (2.57×), and to a lesser degree Dart (1.70×), a logpoint anywhere in a function slows that whole function — even when the logpoint line itself is outside a tight loop. The native engines (Go, Rust, C/C++, COBOL) show no measurable effect outside the logpoint line. The slowdown lasts while the logpoint is set; in the JavaScript and Python check the function was back at its time without the logpoint by the second recorded call after the logpoint was removed or the debugger detached (Dart was not checked).
- **Python delivery limit (issue #1265):** when hits outrun debugpy's delivery rate (measured at 3,200–4,400 lines/s during a run and about 6,000 lines/s draining after a loop), lines still queued when the program exits are lost, and the session's end answer does not say so.

**JavaScript logpoints are compiled by mcp-debugger** (issues #850, #861, #853). js-debug's own logpoints print through the debuggee's `console.log`, which a program that owns its stdout may have replaced (an MCP stdio server — mcp-debugger itself — no-ops it), and js-debug lets a `condition` take precedence over the message. So for a JavaScript session the `logMessage` is compiled into a breakpoint condition that renders the message, delivers it over js-debug's CDP proxy (a `Runtime.addBinding` global the proxy installs; hits before the binding exists are queued in the process and delivered when it arrives, never printed through `console.log`, issue #1212) and never pauses; the entries arrive with category `console`. What that means in practice:

- Strings interpolate raw; everything else renders through `util.inspect` on one line (`obj={ k: 2 }`); a throwing expression renders inline as `<ReferenceError: x is not defined>`; a throwing `condition` logs one `Logpoint condition error: …` line and does not pause.
- A `{expression}` is one JavaScript expression, judged by V8 the way js-debug judges a condition: regex literals, comments, and brackets inside strings are all fine (`{/;/.test(s)}`, `{JSON.stringify({a: 1})}`); a statement list (`{a; b}`) is refused. The only lexical limit is the brace scanner's: a `}` inside a regex literal ends the expression early — write that `}` in a string. `{{foo}}` is the object-literal shorthand `({foo})`; an unclosed `{`, an empty `{}`, a stray `}` and a brace group with an unbalanced quote (`{it's}`) are literal text, and the groups after them still interpolate.
- A `logMessage` whose expression does not compile is refused by `set_breakpoint` with V8's message; a plain `condition` js-debug rejects is reported on the breakpoint (`list_breakpoints` → `message`, and the launch's unbound-breakpoint warning) in js-debug's own words, as well as in the output stream.
- A logpoint set before `start_debugging` makes js-debug stop on entry so the delivery binding is installed before the first hit; the session auto-continues that stop (it is not reported, `wait_for_stop` never sees it), exactly as it does for a pre-launch function breakpoint.

Support is adapter-dependent:

| Adapters | Behavior |
|---|---|
| Python, JavaScript/TypeScript, Go, Rust, C/C++, COBOL, Dart/Flutter, mock | Supported — logs without pausing (COBOL: `{WS-NAME}` is a COBOL data reference evaluated by the shim; Dart/Flutter: the SDK adapter ignores a `condition` on a logpoint, so every hit logs) |
| Java, .NET, Ruby | Not supported — `set_breakpoint` with `logMessage` fails fast with a clear error (rdbg would silently convert a logpoint into a *pausing* breakpoint, issue #469) |
| Adapters whose support is genuinely unknown (dynamically loaded) | Accepted with a warning; validated against the adapter's live capabilities at launch — the `start_debugging` response names each logpoint downgraded to a pausing breakpoint |

---

### list_breakpoints

Lists all breakpoints in a session with their current verified state and adapter-assigned ids. Works before launch (queued breakpoints, `verified: false`), while running or paused, and after the program exits.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.
- `file` (string, optional): Only list breakpoints in this file.

**Response:**
```json
{
  "success": true,
  "breakpoints": [
    {
      "id": "28e06119-619e-43c0-b029-339cec2615df",
      "file": "C:\\path\\to\\project\\app.py",
      "line": 10,
      "verified": true,
      "adapterId": 3
    },
    {
      "id": "bbe96ee0-6c6d-47b1-a3ef-166ffbde3028",
      "file": "C:\\path\\to\\project\\src\\cli\\http-command.ts",
      "line": 398,
      "verified": true,
      "adapterId": 2,
      "boundFile": "c:\\path\\to\\project\\dist\\cli\\http-command.js",
      "boundLine": 305
    }
  ],
  "count": 2,
  "functionBreakpoints": [],
  "functionCount": 0
}
```

**Notes:**

When at least one breakpoint is listed and the attach is still running or paused
with child debugging off, the session-level `warning` adds:

> Verified says the breakpoint is bound in the attached process, not that a process the target starts will stop on it; see adapterConfig.autoAttachChildProcesses in the attach_to_process description.

- The array is sorted by file, then line. Conditional breakpoints include their `condition`; Java suspend policies appear as `suspendPolicy`.
- `functionBreakpoints`/`functionCount` are always present in the unfiltered response (empty arrays when none exist). When filtering by `file` they are omitted — function breakpoints are session-global, not file-scoped.
- `adapterId` is the debug adapter's own numeric id for the breakpoint, captured from setBreakpoints responses and breakpoint events. It is absent until the adapter has seen the breakpoint.
- `message` is the adapter's own words about the breakpoint: its validation message on a set, or its refusal when the adapter declined a live re-send of the file's breakpoints (a `set_breakpoint`, `remove_breakpoint` or `clear_breakpoints` on a live session, or the post-launch/post-attach re-send) — e.g. debugpy's `Server is not available` under `noDebug`. A refusal is the adapter's answer to the request, not a verdict on any one breakpoint: it is stamped as the `message` of every *unverified* breakpoint the re-send covered, marked `messageOrigin: "refusal"` (a refused pre-launch set is echoed and marked the same way), while a breakpoint the adapter had verified before (or a stop proved bound) stands as it was — the adapter never said it was gone. The stamp is dropped the moment anything verifies the breakpoint, and it never displaces a curated note such as the capability-drift warning (issue #754). `messageOrigin` names who wrote `message` when it is not the adapter's verdict on the breakpoint: `"refusal"` as above, or `"curated"` for a note of the server's own (the capability-drift warning, a re-resolved anchor at restart, a function that never bound); absent, the words are the adapter's. A re-send that failed without the adapter answering — a timeout, the proxy exiting — leaves the breakpoints as they were, since the previous set may still be armed. Either failure is reported in that call's `warning`, and in `start_debugging`/`attach_to_process`'s `warning` for the post-handshake re-send (`The debugger refused the re-send of the breakpoints for <files>: …` / `The re-send of … failed: …`, one sentence per distinct answer).
- Verification is eventually consistent: some adapters (js-debug, JDI, netcoredbg) bind breakpoints asynchronously and confirm via DAP breakpoint events shortly after launch or class load.
- `warning` (top level) appears only while the session's current launch runs with the debugger off (`noDebug: true` on an adapter that honours it, see `start_debugging`) and at least one listed breakpoint is unverified: "the debugger is off for this launch (noDebug is true): breakpoints cannot bind and no stop is expected; drop noDebug and launch again to debug" — on a paused session (js-debug lands a pause under the flag) only the clause still true of it, "…: breakpoints cannot bind; drop noDebug and launch again to debug". The per-breakpoint records keep the adapter's own answers; a breakpoint the adapter *did* verify is proof this build debugs after all, and the warning (with `debuggerDisabled` and every other debugger-off note) drops (issue #749).
- A breakpoint the program has stopped on is reported `verified: true` from that stop onward, even if the adapter never confirmed it (issue #673), for adapters whose `stopped` event names the breakpoints it hit (`hitBreakpointIds`: js-debug, debugpy, Delve, CodeLLDB — netcoredbg, the JDI bridge and rdbg omit the field). Such a record carries `verifiedBy: "hit"` until the adapter itself confirms it (`"adapter"`); an adapter answer of "unbound" does not downgrade it. A provisional "Unbound breakpoint" `message` is dropped by the hit; any other note is kept.
- On entries of the `breakpoints` array, `boundFile`/`boundLine` appear when the adapter answers under a *different* file from the request. For a source-mapped `.ts` request on a JavaScript launch with maps on (the default) js-debug verifies the request under the `.ts` path, `get_stack_trace` frames show `.ts`, and the pair is absent; it appears when js-debug answers under the generated `dist/*.js` instead — measured with `adapterLaunchConfig: { sourceMaps: false }` (the second entry in the example above was captured that way, and the frames then show the generated file too), and possible whenever the `.ts` source cannot be resolved through the map (issues #673, #700). `file` and `line` keep describing the request; the bound pair is where it landed. (Entries of `functionBreakpoints` use the same names for the bound location of the symbol, present whenever it is bound.)

---

### remove_breakpoint

Removes one breakpoint by id, every function breakpoint with a given name, or every breakpoint at a `file` + `line` location. Takes effect immediately while the program is running or paused (the file's remaining breakpoint set is re-sent to the adapter); also works after the program exits, so breakpoints can be adjusted before a relaunch.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.
- `breakpointId` (string, optional): Breakpoint id from `set_breakpoint` or `list_breakpoints`. Takes precedence over `function` and `file` + `line`.
- `function` (string, optional): Alternative addressing — remove **all** function breakpoints with this symbol name. The same per-language rewrite `set_breakpoint` applies is used here, so the name you set with is the name you remove with (a bare Go `main` matches the stored `main.main`); the response reports the effective name as `functionName` and, when it was rewritten, the original as `requestedName`.
- `file` (string, optional): Alternative addressing — source file path (use together with `line`). Removes **all** breakpoints at that location.
- `line` (number, optional): Alternative addressing — line number (use together with `file`).

**Response:**
```json
{
  "success": true,
  "removed": [
    { "id": "28e06119-619e-43c0-b029-339cec2615df", "file": "C:\\path\\to\\project\\app.py", "line": 10, "verified": true }
  ],
  "message": "Removed 1 breakpoint(s)"
}
```

**Notes:**
- An unknown `breakpointId` (or an empty location or function name) returns `success: false` with an explanatory error; for a function name the error names the effective (rewritten) form, and a bare name with no rewrite gets the same package-qualification hint `set_breakpoint` gives.
- If the live re-send to the adapter fails, the breakpoint is still removed from the session (it will not be re-applied on the next launch) and the response carries a `warning`.

---

### clear_breakpoints

Removes all breakpoints in a session, or all breakpoints in one file. Clearing zero breakpoints is success, not an error.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.
- `file` (string, optional): Only clear breakpoints in this file.

**Response:**
```json
{
  "success": true,
  "cleared": 2,
  "files": ["C:\\path\\to\\project\\app.py"],
  "message": "Cleared 2 breakpoint(s)"
}
```

---

## Execution Control

### The stop snapshot

Every answer that reports the session `paused` — `start_debugging`, `restart_debugging`,
`wait_for_stop`, `pause_execution`, `attach_to_process`, the `create_debug_session` attach
shortcut, and the step tools (`step_over`/`step_into`/`step_out`, issue #983) — additionally
carries a bounded **`snapshot`** of the stopped program's state (issue #982), so reading the
crashing state costs zero extra tool calls:

```json
"snapshot": {
  "exception": { "type": "ZeroDivisionError", "message": "division by zero" },
  "frames": [
    { "name": "compute", "file": "/abs/path/app.py", "line": 44 },
    { "name": "main", "file": "/abs/path/app.py", "line": 61 }
  ],
  "locals": { "subtotal": "125.0", "user": "'ada'" },
  "truncation": "3 variable(s) omitted, 1 value(s) cut — get_local_variables returns the full list",
  "note": "…"
}
```

- **`exception`** appears only on an exception stop: the class/message the adapter reported
  (secret-redacted), topped up with whatever DAP `exceptionInfo` had merged by the time the answer
  was built — never awaited, and never its adapter-side stack trace (`frames` covers the stack). An
  adapter that reported nothing (e.g. a CodeLLDB panic relabel) gets no `exception` key — the
  answer's stop reason already says it was one. `wait_for_stop` omits the key by design: its answer
  carries the full (redacted) `lastStop`, and the same message never ships twice.
- **`frames`** are the top ≤3 frames of the same policy-filtered stack the answer's `location` was
  read from (no second stack fetch).
- **`locals`** is a flat name → value map of the top frame's locals through the same pipeline as
  `get_local_variables` (policy scope selection, the walk-down to the first frame with locals,
  secret redaction), under tighter caps — 20 locals / 200 chars per value by default
  (`DEBUG_MCP_SNAPSHOT_MAX_LOCALS` / `DEBUG_MCP_SNAPSHOT_MAX_VALUE_CHARS`); `truncation` says what
  was cut. The read is bounded (~2 s): if it expires or fails inside the composer, the answer ships
  without `locals` and `note` says so. A read that comes back empty is shown as no locals — and when
  unprobed deeper frames exist (the snapshot probes the top 3), `note` says that too; a
  scopes or variables request that fails is noted as an incomplete locals list, and `get_local_variables`
  on the same stop can retry the read.
  The snapshot is orientation, not navigation —
  `get_local_variables` / `get_variables` remain the way to expand structures or fetch everything.
- **`changedVariables`** replaces `locals` on a repeated stop in the same frame (issue #983) —
  stepping through a function, or a `continue_execution` → `wait_for_stop` loop over one
  breakpoint: only what differs from the locals last shown, one entry per variable (issue #1140):
  - a changed value — `{ "before": "100.0", "after": "125.0" }`;
  - a variable that appeared — `{ "after": "30", "new": true }`, with no `before`;
  - a variable that left scope — `{ "before": "3", "gone": true }`, with no `after`.

  No placeholder ever stands in for a missing side: any text can be a value. An **empty `{}` means
  nothing visible changed** — that is information. The flags are only set when they are known. The
  locals a snapshot shows are capped (see `locals` above), so a name missing from a list that was
  cut may only not have fitted: a variable absent from a previous list that was cut is
  `{ "after": "30" }` with no `new`, and one absent from a current list that was cut is not listed
  at all (`truncation` says when a list was cut). A failed scopes or variables request also makes the list
  incomplete (`note` explains it): missing variables are not called `gone`, and variables that
  reappear after the failed read are not called `new`. An adapter's own return-value entry — js-debug's
  `Return value` at a function's return point, debugpy's `(return) fn` after stepping over a call —
  is a local like any other here and appears as `new`. Frame identity is the locals anchor's name + file +
  visible stack depth + the caller chain's names, files and call-site lines (issue #1183): stepping to a different
  function, changing recursion depth, calling from another line, landing back in the origin function after `step_out`,
  or hitting an unresolved caller unwind frame all re-emit full `locals` and rebase — never a wrong diff. (Two separate
  invocations of one function called from the exact same loop line without an intervening `step_out` share one stack
  signature — DAP frames carry no cross-stop activation ID — so `continue_execution` across iterations of one breakpoint
  intentionally diffs iteration-to-iteration.) The same stop answered twice (two
  `wait_for_stop` calls without resuming) re-emits full `locals` rather than diffing against
  itself. Two different secrets masked to the same `<redacted:…>` placeholder compare equal, so
  a changed secret may not be listed. The cache resets on relaunch/re-attach, so a new run's
  first stop always shows full `locals`.
- **Not carried** on: entry stops (module scaffolding, not state), dry runs, `pending: true`
  answers, the `pause_execution` "Already paused" fast path (call `wait_for_stop` for the full
  snapshot of the current stop), `continue_execution` (answers `running`), and any stop whose
  landing read failed. Under `DEBUG_MCP_VARIABLE_ACCESS=explicit` the `locals` half is withheld
  (exception and frames stay). `DEBUG_MCP_NO_SNAPSHOT=1` turns the snapshot off entirely.

### start_debugging

Starts debugging a script.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.
- `scriptPath` (string, required): Path to the script to debug. Must be **absolute** in host mode (a relative path is rejected with `Path must be absolute`); in container mode it is re-rooted under `MCP_WORKSPACE_ROOT`.
- `args` (array of strings, optional): Command line arguments for the script.
- `dapLaunchArgs` (object, optional): Standard DAP launch arguments:
  - `stopOnEntry` (boolean): Stop at first line (default `false` — the opposite of attach, which pauses unless `stopOnEntry` is `false`)
  - `justMyCode` (boolean): Debug only user code (default `true`). What filters library or generated frames during `step_into` is engine-specific (issue #1184): **Python** (`debugpy`) honours `justMyCode` directly (`false` steps into stdlib/site-packages). **JavaScript** launch: `true` puts `node_modules` on js-debug's `skipFiles` beside Node internals, and a step does not stop in skipped code: the server steps through it itself, so `step_into` follows a call through skipped code into your own function when its walk reaches it within 512 engine steps, and otherwise steps out and says so (issue #1130; see [`step_into`](#step_into)). The walk has no time bound, so a step lands in the same place on every host; where an engine step is slow (about 44 ms on Linux, issue #1163) a long walk answers `pending: true` first, saying it is walking through skipped code, and `wait_for_stop` answers where it lands. `false` takes `node_modules` off the list and turns that stepping off, so every step lands where V8 lands, inside dependencies and Node internals. A pause lands where the program is either way. A caller `skipFiles` replaces the default list. Source maps are on for every JavaScript launch, `.js` programs included — stops report `src/*.ts` when maps and sources are present; `adapterLaunchConfig: { sourceMaps: false }` opts out (issue #684). **.NET** (`netcoredbg`): forwards `justMyCode`, and on launch `netcoredbg` additionally defaults `enableStepFiltering` to `true`, skipping property accessors and operators on `step_into` unless `dapLaunchArgs: { enableStepFiltering: false }` is passed (attach ignores `enableStepFiltering`; see the [.NET guide](dotnet/README.md)). **Rust** (`CodeLLDB`): CodeLLDB's Rust language support sets a step-avoid filter for `std`/`core`/`alloc` (including `Drop::drop` glue invoked via `core::ptr::drop_in_place`). **Java** (`JdiDapServer`): the JDI bridge does not yet filter `step_into` by `justMyCode`, so `step_into` enters JDK methods when called first on a line (issue #1189; `note` discloses the internal JDK frame, issue #1181). **Dart/Flutter**: the SDK adapters ignore `justMyCode` and instead read `debugSdkLibraries` / `debugExternalPackageLibraries`, both defaulting to `true` in the SDK adapter unless set to `false` in `adapterLaunchConfig` / `dapLaunchArgs` (see the [Dart guide](dart/README.md)).
  - `noDebug` (boolean): DAP's "launch without enabling debugging" flag (default `false`). What it does depends on the adapter, and the response says which case you are in. **Honoured** — the debugger is off: no breakpoint binds, no exception filter arms, no entry stop lands, and no breakpoint, exception or entry stop ever arrives, so a short script ends `stopped` and a server stays `running`. That is a legitimate plain run and says nothing by itself; when the session has breakpoints (line or function), an explicit `breakOnExceptions` other than `"none"`, or `stopOnEntry`, the `warning` says the debugger is off for this launch and names what will not fire — not that no stop of any kind can come — in place of the unbound-breakpoint diagnostics that would otherwise send you to check paths that are fine (issue #710). js-debug, debugpy, Delve and CodeLLDB honour it (debugpy and Delve open no configuration phase at all, so the launch is complete on the launch response; CodeLLDB refuses the configuration requests, and the refusal reaches the `warning` and `get_output` — issue #746). The run ends `stopped` with the program's output and, where the adapter reports one, the exit code (Delve states it as a console line, `Process N has exited with status S`, which is read back as `exitCode` — issue #753). Under the flag Delve runs the program through Go's `exec`, so on Windows the binary needs its `.exe` extension. **Ignored** — rdbg, netcoredbg and the Java bridge run the debugger regardless, and the rust launch transform never forwards the flag: the `warning` says the flag had no effect and everything works as usual. The same warning comes back from `restart_debugging` and from a `dryRunSpawn` check. While such a launch runs, the session remembers the decision (`list_debug_sessions` reports `debuggerDisabled: true`) and every later surface says why: `set_breakpoint` and `list_breakpoints` keep the adapter's own answer (still sent — e.g. js-debug's "Unbound breakpoint", or CodeLLDB's refusal echoed onto each pre-launch breakpoint) and add "the debugger is off for this launch (noDebug is true)…", `pause_execution` is still sent and the same sentence explains a pause that never lands or one the adapter refused, and `step_*`/`continue_execution`/`get_stack_trace`/`get_local_variables`/`evaluate_expression` append it to their "not paused" answers. A `stopped` event only a live debugger produces — a breakpoint the adapter itself reports (or names in `hitBreakpointIds`), an exception stop, an entry stop — proves the debugger on for that adapter build and clears the decision, and so does a breakpoint the adapter verified (every honouring adapter refuses or unbinds one under the flag, so a bound one can only come from a build that ignores it); a pause, a step taken from one, or a `debugger;` statement do not (js-debug lands all three under the flag while its breakpoints stay unbound; an uncaught throw does not stop). On a paused session the sentence keeps only the clause still true of it — breakpoints cannot bind — and outside a live launch (`initializing`/`running`/`paused`) the decision is neither reported nor consulted (issue #749).
  - Additional DAP launch keys (`program`, `cwd`, `env`, language-specific options) pass through to the adapter. For Python, `module` (`python -m <module>`) or `code` (`python -c`) replaces `program`: debugpy takes exactly one target, so the launch goes out without `program` and the response's `warning` says so (`dapLaunchArgs.module: launched as a module (python -m); program is not sent …`); `scriptPath` still has to name an existing file, and `cwd` is what `-m` puts on `sys.path`: for these launches it defaults to the directory above the top-most package containing `scriptPath` (the `warning` names it), and a module launch of a project sets it to the project root explicitly (issue #985). `dryRunSpawn` reports such a launch's `data.script` as `module: <name>` or `code: …`. Top-level parameters do **not** belong here: a nested `breakOnExceptions` is honored as an alias (the top-level value wins if both are given) and reported via a `warning` in the response; other misplaced top-level keys (`dryRunSpawn`, `sessionId`, `scriptPath`, `adapterLaunchConfig`) are stripped with a warning instead of silently riding into the launch config.
- `adapterLaunchConfig` (object, optional): Adapter-specific launch configuration overrides. Use this for language-specific settings that go beyond standard DAP arguments (e.g., `mainClass` and `classpath` for Java, `buildCommand` for Rust). For Rust, `_adapterSettings` passes through to CodeLLDB (issue #441) — e.g. `{"_adapterSettings": {"scriptConfig": {"lang": {"rust": {"sysroot": "/path"}}}}}` points the Rust formatter lookup at an explicit sysroot; the `CODELLDB_RUST_SYSROOT` env var does the same without per-launch config (a user-supplied `_adapterSettings` value wins over the env var).
- `dryRunSpawn` (boolean, optional): check the launch without starting anything (issue #812). The whole launch preparation runs — the toolchain gate, the adapter and its environment checks, the launch transform (which compiles a source-file program for C/C++, Rust and COBOL, as a launch would), executable resolution, the adapter command — and the answer carries `data.dryRun: true`, `data.command` (the adapter spawn command, or `[connect] host:port` for a connect-mode adapter), `data.script` (the program the engine would run, after the transform) and `warning` (the configuration notices a launch would return). The session is left exactly as it was: the answer's `state` is the session's current state, a running or paused program keeps running, and the previous run's output, exit code and last stop stay readable. No proxy is spawned and nothing is recorded, so a dry run is never a launch: `restart_debugging` still replays the last real launch, and the real `start_debugging` on the same session binds every breakpoint already set (issue #793). Not available for an attach-shaped configuration (`request: "attach"`): preparing an attach acts on the target process. One compile-side caveat: a dry run of a C/C++, Rust or COBOL source recompiles it exactly as a launch would (C/C++ into `.debug-mcp/`, beside a running binary when that one is locked), and the stale-build note compares the source with the newest artefact, so a note on a program paused from an older build clears after a dry run even though the paused program is still the old build.
- `breakOnExceptions` (string, optional): `"uncaught"` pauses at uncaught exceptions at the crash site (stack and locals inspectable) instead of terminating the session; `"all"` also pauses on caught/raised exceptions (language-dependent). **Launch sessions default to `"uncaught"`** (issue #244) — a crashing script pauses with `lastStop.reason: "exception"` instead of terminating; pass `"none"` to opt out and let it run to termination. Ruby is the exception: rdbg has no uncaught-only filter, so Ruby launches stay `"none"` by default (only explicit `"all"` is available) — an explicit `"uncaught"` on Ruby arms nothing, and the response's `warning` says so and names `"all"` (issue #1032). Attach sessions never apply a language default. The "still running" answer of `start_debugging` and `wait_for_stop` promises a crash stop only when one is actually armed: under `"none"`, on an adapter with no uncaught-only filter whose engine does not stop on its own (Ruby; C/C++ on Windows), or on an attach that requested no mode, it says a crash runs to the program's exit (issues #1009, #1032). The abstract mode maps to per-language debugger filters (e.g. Python `uncaught`/`raised` — a pytest module launch, the `testRunner: "pytest"` preset included, arms `userUnhandled` beside `uncaught` under the default, since pytest catches test failures and `uncaught` alone never fires on one; JavaScript `uncaught`/`all`, Java `uncaught`/`caught`, .NET `user-unhandled`/`all`, Go `unrecovered-panic`+`runtime-fatal-throw`, Rust `rust_panic`, C/C++ `cpp_throw` for `"all"` — its `"uncaught"` default sets no filter since uncaught throws crash via SIGABRT, which pauses natively on Linux and macOS (on Windows `abort()` exits with code 3 and nothing pauses, issue #1032); COBOL `cobol_runtime_error` for both modes — a function breakpoint on libcob's `cob_runtime_error`, which only fires when the program was compiled with `runtimeChecks: true`; Dart/Flutter `Unhandled` for `"uncaught"` and `All` for `"all"` — the SDK adapters' own filters); an explicitly requested unsupported mode is skipped with a warning. Python edge: debugpy treats `sys.exit(n)` with a **non-zero** code as an unhandled `SystemExit` and pauses there (`sys.exit(0)` runs to completion normally) — pass `"none"` if a script legitimately exits non-zero via `sys.exit`.
- `testRunner` (string, optional): run `scriptPath` under a test runner the language declares a preset for (issue #985) — `list_supported_languages` lists `testRunners` per language; Python declares `pytest`. The preset builds the launch: for pytest, `python -m pytest <scriptPath>[::testTarget] -x …` plus, per plugin, `-p no:xdist` / `-p no:cov` — or the plugin's inert switch (`-n0` / `--no-cov`) when the project's own `addopts` turns it on, since `-p no:` would make pytest reject those options — left out when your `args` ask for that plugin; run from pytest's rootdir — the nearest ancestor of the test file holding `pytest.ini`, a `pyproject.toml` with a `[tool.pytest.ini_options]` table, a `tox.ini` with `[pytest]` or a `setup.cfg` with `[tool:pytest]`, else the nearest `setup.py` (pytest's own rule), else the top-most `conftest.py` ancestor, else the file's directory; `dapLaunchArgs.cwd` overrides it — with debugpy's `userUnhandled` filter armed beside `uncaught` under the `breakOnExceptions` default, because pytest catches every test failure and `uncaught` alone never fires. The answer is the autopsy: paused at the failing assert, or at the raise site of an exception that escapes the test, with `snapshot.exception`, `snapshot.frames` and `snapshot.locals`; a passing test runs to completion with exit code 0. Measured shapes (docs/python/spike-notes-pytest.md): a raise inside a helper puts the helper frame first, flagged `unwound: true`, and the live test frame below it (issue #1143); an exception `pytest.raises` expects never stops on Python 3.12+ and stops once on 3.11 and older (pydevd's frame-tracing path; continue); `pytest.skip()` stops once (continue); a fixture that raises stops in the fixture; a test's `print` reaches `get_output` with pytest's report after the run, not before the pause (pass `args: ["-s"]` for live prints). `args` are appended as pytest arguments. An undeclared runner is refused by name before anything starts, and a `testTarget` without `testRunner` is refused too. The preset travels inside `adapterLaunchConfig` (`testRunner`/`testTarget`), so `restart_debugging` replays it and a dry run reports `data.script: "module: pytest"` with the expansion in `warning`.
- `testTarget` (string, optional): with `testRunner`, the test inside `scriptPath` to run — `test_name`, `Class::test_name`, `test_name[param]` — or a full node id of that file (`tests/test_x.py::test_name`; one naming another file is refused). Omit to run the whole file.

**Response:**
```json
{
  "success": true,
  "state": "paused",
  "message": "Debugging started for /abs/path/examples/python_simple_swap/swap_vars.py. Current state: paused",
  "location": { "file": "/abs/path/examples/python_simple_swap/swap_vars.py", "line": 10, "column": 1 },
  "context": {
    "lineContent": "    a = b  # Bug: 'a' loses its original value here",
    "surrounding": [
      { "line": 8, "content": "    # Or Python's tuple assignment: a, b = b, a" },
      { "line": 9, "content": "    " },
      { "line": 10, "content": "    a = b  # Bug: 'a' loses its original value here" },
      { "line": 11, "content": "    b = a  # Bug: 'b' gets the new value of 'a' (which is original 'b')" },
      { "line": 12, "content": "    " }
    ]
  },
  "snapshot": {
    "frames": [ { "name": "swap", "file": "/abs/path/examples/python_simple_swap/swap_vars.py", "line": 10 } ],
    "locals": { "a": "10", "b": "20" }
  },
  "data": {
    "message": "Debugging started for /abs/path/examples/python_simple_swap/swap_vars.py. Current state: paused",
    "reason": "breakpoint",
    "location": { "file": "/abs/path/examples/python_simple_swap/swap_vars.py", "line": 10, "column": 1 }
  }
}
```

**When the launch answers:** once the program is launched, `start_debugging` holds its answer for a short window and reports the session as it is when the first of three things happens — the same way in every language (issues #815, #823, #826):

- **The program stops** — `state: "paused"` with `reason`, and where, the way `wait_for_stop` answers a stop (issue #951): `location` is the first visible frame, `context` the source line around it, and `threadId` and `note` appear when there is something to say — the answer anchored on a thread other than the reported one, no frame of the stack being program code (as for `pause_execution`), or the compiled file the debugger binds the location through being older than its source (the stale-build sentence `set_breakpoint` warns with, issues #938/#950). The [stop snapshot](#the-stop-snapshot) rides beside them — exception, top frames and bounded locals in the same answer (issue #982; not on an entry stop). `location` and `threadId` sit at the top level and in `data`; `context`, `snapshot` and the full `note` at the top level (`data.note` is the session layer's part of the note, without the stale-build sentence the handler appends). A breakpoint reached as the program starts is answered here, in the one call (the example above).
- **The program ends** — `state: "stopped"` with the run-to-completion summary and `exitCode` below.
- **The hold elapses** — `state: "running"` with **`pending: true`** (top level and in `data`, like `step_over`) and a `message` that says what is armed: `…has not reached 2 breakpoint(s) yet. Nothing was cancelled: what is armed stays armed…`; or, with nothing armed (the `"uncaught"` default does not count — a crash is not a stop you are waiting for), `…nothing is armed to stop it (no breakpoints, no entry stop, no caught-exception filter)…`; or, for a `noDebug` launch, that the debugger is off. Logpoints the adapter runs on never stop the program, so they are named apart: `…1 logpoint(s) that log without stopping is armed (read get_output for the messages), and nothing is armed to stop it (no pausing breakpoints, …)…`. What is armed is read when the answer is built, so a breakpoint set while the launch was in flight is named.

The hold is not a limit on the program. Nothing is cancelled when it elapses: breakpoints and exception filters stay armed for the life of the process, and the program pauses when it reaches one — in a second or in a day. The hold only decides whether this call reports the first stop itself. It is deliberately short (about a second, sized from the measured time each adapter takes from launch to a first breakpoint; the number is a tunable, not part of this contract), so that a launch whose breakpoint needs an outside trigger — a request handler in a server — hands control back at once. To wait for the stop, call [`wait_for_stop`](#wait_for_stop), which blocks until the program stops or ends for as long as you say; `list_debug_sessions` reports the state without waiting.

Two things are outside the hold. A `stopOnEntry` launch is answered at its entry stop however long the program takes to reach it, because that stop is certain to come. And whatever precedes the launch — compiling a source file, starting the adapter — happens before the hold begins.

A breakpoint set, removed or cleared while a launch is still starting is delivered to the adapter as soon as the program is launched (issue #851).

**Sessions with children** (the session tree, issues #1081, #1082, #1150 and #1221): when a child session was adopted during the hold (a Python launch — debugpy's sub-process debugging is on by default; `dapLaunchArgs: { subProcess: false }` opts the launch out — where debugpy reports each process the program starts; a JavaScript launch — js-debug's `autoAttachChildProcesses` is on by default; `dapLaunchArgs: { autoAttachChildProcesses: false }` opts the launch out — where js-debug reports each Node process it forks), the answer carries `children: [{ sessionId, name, state, parentSessionId }]` — every descendant, depth first in adoption order, each with its state and the session that spawned it. When an adopted child is already genuinely `paused` while the launched root is `running`, the hold ends after a short settle grace (~50 ms), `message` names the paused child session directly instead of saying no breakpoint was reached yet, and `pausedChild: { sessionId, name, state: "paused", reason, location?, threadId?, context?, note?, snapshot? }` delivers that child's stop landing and bounded snapshot in the same call so you can inspect, step, or continue `pausedChild.sessionId` immediately without spending an extra `wait_for_stop` turn (`pausedChild` is never set for a child in `error` or `stopped`). `childrenReleased: n` says how many children reported anywhere in this session's subtree this run were confirmed released to run undebugged (beyond `DEBUG_MCP_MAX_CHILD_SESSIONS`, or a failed adoption whose fallback release the debug adapter confirmed) — and the `message` of the same answer says what that means and why (issue #1137), e.g. "1 child process was released to run undebugged (child sessions are off: DEBUG_MCP_MAX_CHILD_SESSIONS=0): a breakpoint only it reaches will not hit."; when a failed adoption's fallback release was not confirmed by the adapter (issue #1221), it is not counted in `childrenReleased` and `message` states that whether the child continued running is not known — and `childrenClosed: n` says that the start tore down a previous run and closed its children with it. `children`, `pausedChild`, `childrenReleased` and `childrenClosed` sit at the top level beside `pending` and in `data` (`pausedChild.snapshot` is omitted from `data.pausedChild` just like a root `snapshot`), and are absent when there is nothing to say, so a session with no children answers as before.

**JavaScript launch configuration:** Both launch option objects accept js-debug settings;
`adapterLaunchConfig` wins when a key appears in both. The effective `stopOnEntry` value controls
the entry pause and is replayed by `restart_debugging`. An honoured `noDebug` disables that pause.

Ignored or malformed options produce a `warning` naming the input object and key. Unrecognized
options remain forwarded, with a warning and a spelling suggestion when available. Warnings also
appear once in `get_output` after launch setup, are returned by `dryRunSpawn`, and are retained in
`data.warning` when preparation fails. A subsequent launch starts with fresh notices.

For JavaScript, a program under `node_modules` defaults `cwd` to the folder containing its
outermost `node_modules`, including nested pnpm paths. The launch's `warning` names that directory
and the `dapLaunchArgs.cwd` override; change or remove `adapterLaunchConfig.cwd` if present,
because it takes precedence. Relative runner programs resolve against the launcher's working
directory before selecting this default. Other programs default to the directory containing
`scriptPath`, even when `dapLaunchArgs.program` differs. An explicit `cwd` is preserved and
produces no default-directory notice.

For JavaScript, `envFile` resolves relative to the effective `cwd` (absolute paths work too).
Its dotenv values override the inherited environment; explicit `env` entries override the file,
and `null` removes a variable. This also applies to `NODE_ENV` and `NODE_OPTIONS`; without a file
or explicit override, the existing `NODE_ENV=development` default applies. A missing file produces
a warning; another read error fails the launch. The server's own environment is unchanged.
See the [JavaScript configuration guide](javascript/README.md#custom-configuration).

**Pause Reasons:**
- `"breakpoint"`: Stopped at a breakpoint
- `"step"`: Stopped after a step operation
- `"entry"`: Stopped on entry (if configured)
- `"exception"`: Stopped at an exception (the launch default for most languages; see `breakOnExceptions`). `lastStop.description`/`lastStop.text` carry the exception class and message where the adapter reports them — secret-redacted wherever an answer emits them (`wait_for_stop`, `get_stack_trace`, `list_debug_sessions`), like variable values (issue #982). Where the adapter supports the DAP `exceptionInfo` request (Python, JavaScript, Java, .NET, mock), `lastStop.exceptionInfo` is additionally populated best-effort with `exceptionId`, `breakMode`, and optional `details` (message, type names, adapter-side stack trace). The enrichment is requested asynchronously right after the pause, so it may appear in `list_debug_sessions`/`get_stack_trace` a moment after the stop itself — re-query if it is absent immediately after pausing.

**A launch that ends before it can report a pause** answers `state: "stopped"` and says how the program ended (issues #701, #1254):

```json
{
  "success": true,
  "state": "stopped",
  "message": "Debugging started for /abs/path/app.js. Current state: stopped. The program ran to completion (exit code 0) without hitting any breakpoint. Verified but never hit: app.ts:91.",
  "exitCode": 0,
  "unhitBreakpoints": [{ "file": "/abs/path/src/app.ts", "line": 91, "verified": true }],
  "data": {
    "message": "Debugging started for /abs/path/app.js. Current state: stopped. The program ran to completion (exit code 0) without hitting any breakpoint. Verified but never hit: app.ts:91.",
    "exitCode": 0,
    "unhitBreakpoints": [{ "file": "/abs/path/src/app.ts", "line": 91, "verified": true }],
    "stopOnEntrySuccessful": false
  }
}
```

- The sentence distinguishes a clean run (`ran to completion (exit code 0)`), a non-zero exit (`exited with code N`) and a debuggee that reported no code at all (`ended without reporting an exit code` — attach targets, signal-killed debuggees, adapters that send no `exited` event and state the code nowhere else).
- `exitCode` (top level and in `data`) is present only when the debuggee reported one. When neither this session nor an adopted child session stopped during the run, `unhitBreakpoints` lists every line breakpoint the program ran past (`file`, `line` as bound, `requestedLine` when the adapter moved it, `verified`; in `data`, and hoisted to the top level when non-empty — withheld altogether after a stop on the session or a child, below); logpoints the adapter supports are left out, since they log and run on. Verified line and function breakpoints that were never hit are named in the sentence; breakpoints that never bound keep their #467 `warning`.
- On a **non-zero exit** when program output was captured on that session's buffer, `outputTail` (at the top level, omitted from `data` like `snapshot`; issues #1254, #1136 and #1277) is the last 8 non-empty lines of the program's own output (a line longer than 300 characters is cut to 300 characters plus `"…"`), in the order their output arrived, whatever the stream (which for lines from different streams can differ from the order the program wrote them) — leaving out adapter `console` lines and known adapter banners (Node's inspector banners and js-debug's breakpoint syntax-error line on `stderr`, a launched JVM's `Listening for transport dt_socket at address: …` banner on `stdout`, and CodeLLDB's `Stop reason: …` line on `stderr`; an exact match on a fixed banner, or a program `stderr` line starting with `Stop reason: ` or js-debug's `Syntax error setting breakpoint with condition … on line N: …` prefix, cannot be told apart and is left out), while keeping `console` events that carried an explicit `"category": "console"` under Dart/Flutter (`dart:developer` `log()` records including indented continuation lines, `dart test` / `flutter test` `✓` / `✖` / `!` result lines, and — read in `flutter_adapter.dart`, not measured — Flutter's own launch and build lines before the app has started plus `Failed to Hot Reload/Restart: …`; category-less `console` events such as lifecycle lines and logpoints, plus server notices, stay out). Consecutive chunks of the same category are joined before splitting on newlines (ending the line after an 8,192-character `truncated` chunk, so a line arriving in consecutive pieces takes the place of its last piece, while one line whose two chunks are separated by an entry of another category — such as a `console` logpoint — stays two lines). When the runtime does not put its cause last, `outputTail` replaces the plain last 8 in two cases: first, when the adapter recognises a runtime fatal-error line and the **last** such line is not among the last 8; otherwise, when no fatal-error line was recognised and all 8 fall inside one `stderr` block longer than 8 lines (`stderr` lines not interrupted by a line of the program's `stdout` or reclaimed `console` output; adapter `console` lines, blank lines and banners do not interrupt it). In either case `outputTail` is that head line and the 3 after it, one marker line `"... (N lines omitted)"` (the one line the server writes itself), and the last 3 lines; a runtime that prints the cause at the end of a trace (Python) declares so, and then the plain last 8 lines are quoted. Known limits: when `stdout` or reclaimed `console` arrives after a long `stderr` trace without a recognised fatal-error line, the trace's head is not kept; and if an earlier child process sharing the buffer printed a recognised fatal-error line and the parent later printed more than 8 lines and exited non-zero without one, that earlier line is taken as the head. On Linux (measured; expected on macOS, not measured), CodeLLDB launches the debuggee on a pseudo-terminal and delivers both streams as `stdout`, so the `stderr`-block rule does not apply there; the recognised fatal-error line keeps the cause for the three runtimes that declare one — GnuCOBOL's `libcob` (`libcob: … error: …`), `libstdc++`'s `terminate called …`, and in Rust the main thread's panic line (`thread 'main' … panicked at …` / `has overflowed its stack`, limited to `'main'` because a panic in a spawned or test-harness thread does not end the process) — while a C program that ends by `assert` or `abort` has none. When `outputTail` is present, `message` adds a short clause pointing at `get_output` for the full output without repeating the lines (`See outputTail (get_output has the full output).`). `outputTail` is absent when `exitCode` is `0`, when no exit code was reported, and when no program output was captured; it reads only that session's own buffer and never walks the session tree.
- When a stop and the exit arrived in the same tick (a breakpoint hit as the program ended), the breakpoints were not all missed: the list is withheld and the sentence names the stop (`after a stop the launch could not report (last stop: breakpoint)`), which `list_debug_sessions` also shows as `lastStop`.
- The same holds for the session's tree (issues #1128, #1150): when a child session stopped during the run, the parent can no longer say which breakpoints were missed — each child has its own copy of the breakpoints and its own stops. The list is withheld and the sentence counts the tree's stops instead, every stop the agent could see on a child, whatever its reason (`The program ran to completion (exit code 0). Its child sessions stopped 2 times during this run.`), whether or not the child is still listed. When children were adopted and none stopped, `unhitBreakpoints[].verified` (and the unbound-at-exit `warning`) reflects whether the breakpoint bound in **any** session of the tree, so a breakpoint that bound only in an adopted child reads `verified: true` and never triggers a false unbound warning; and when child-process debugging was turned off — either explicitly (`subProcess: false` on a Python launch or `autoAttachChildProcesses: false` on JavaScript) or by the JavaScript adapter's own default on an attach (where the answer names `adapterConfig: { autoAttachChildProcesses: true }` as an option if the breakpoint code runs in a process the target starts, with its `NODE_OPTIONS` and detach costs) — the end summary names `the attached process` on an attach (versus `the launched process` on a launch) and both the summary and any unbound warning explain that a breakpoint in code only a process the target starts afterwards runs is never hit unless debugging those processes is requested; they name the attach option and explain that later children load a server file through `NODE_OPTIONS` and wait at startup for the debugger, so an unavailable preload can prevent startup, fast forks can start late, and a child forked during detach can remain waiting (#1286).
- `restart_debugging` returns the same fields for a relaunch that ends the same way (`exitCode` and `unhitBreakpoints` at the top level and in `data`, `outputTail` at the top level only).

**Exit code:** when the debuggee terminates, the exit code reported by the adapter is surfaced as `exitCode` in `list_debug_sessions` (and at the top level and in `data.exitCode` on `start_debugging` / `restart_debugging` when the launch ended inside its hold, plus top-level `outputTail` on a non-zero exit with program output), so a crash or failed test-runner startup (non-zero) is distinguishable from a clean exit without a separate `get_output` call. Adapters that never send `exited` still get one where the debugger states the code some other way: js-debug through the launch shim's recorded code (#247), rdbg through the adapter process's own exit status (#258), Delve before 1.27 through its `Process N has exited with status S` console line (#753 — in debug mode Delve prints it only in reply to `disconnect`, so the proxy sends the disconnect before forwarding `terminated`; Delve 1.27+ sends `exited` itself). No line, no code: nothing is guessed.

**Between launches:** a session whose program has exited is still present, with its breakpoints, its last real launch and, until the next launch, the previous run's output and exit code (a dry run leaves all of it in place). `start_debugging` (a new configuration), `restart_debugging` (the same one), `set_breakpoint`, `list_breakpoints`, `remove_breakpoint`, `clear_breakpoints` and `get_output` all work on it, so "ran to completion without hitting my breakpoint → set an earlier one → `restart_debugging`" needs no new session; each launch starts a fresh output buffer and re-applies the stored breakpoints with their verified state reset. Tools that need a live debuggee — stepping, `continue_execution`, `pause_execution`, `list_threads`, `get_stack_trace`/`get_scopes`/`get_variables`/`get_local_variables`/`evaluate_expression`, `get_source_context`, `expose_session` — answer `Session is terminated: <id>` until the next launch (issues #793, #806). The inspection tools (`get_stack_trace`, `get_scopes`, `get_variables`, `get_local_variables`, `evaluate_expression`) add a `message` beside that error saying what it means and what to do next, worded for what the session is (issue #1141): a launched program — `The program has terminated, so no frames or variables exist. Use restart_debugging to run it again.`; an attach session, which `restart_debugging` refuses — `The debugger is no longer attached to the target (it ended, or was detached), so no frames or variables exist. Use attach_to_process to attach again.`; a child session — that its process ended or was released, and the id of its parent.

---

### restart_debugging

Restarts the debuggee in one call. When the adapter offers a native restart (DAP `supportsRestartRequest` — the Flutter adapter advertises it once the app has started), the DAP `restart` request is sent and the session goes on in place: for Flutter that is a **hot restart**, `main()` re-runs in the same process and the first breakpoint is reached again about half a second later (measured on Windows desktop and Chrome). Otherwise the current program is terminated (if still running) and relaunched with the same configuration as the last `start_debugging`. Either way the current breakpoints stay in force — the core edit-rerun loop (`fix a line → restart → confirm at the same breakpoints`) is a single tool call instead of close/create/re-set/start.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.

**Response:** mirrors `start_debugging`, plus:
```json
{
  "success": true,
  "state": "paused",
  "message": "Debugging started for /path/app.py. Current state: paused",
  "data": {
    "reason": "breakpoint",
    "breakpointsReapplied": 2,
    "outputReset": true
  }
}
```

**Notes:**
- Works while the program is running, paused, **or after it has exited** (the primary use case — a finished session can be restarted without recreating it).
- **Which path ran is in the answer**: `data.hotRestart: true` means the adapter's own restart was used (same process, output buffer kept, no `outputReset`); otherwise the restart was terminate + relaunch (the DAP-spec-blessed emulation every launch-mode language gets) and `outputReset: true` is set. The native path is taken only for adapters measured for it (the policy's `restartViaDapRequest` pin) that also advertise `supportsRestartRequest` live — today Flutter. js-debug advertises `restart` too but relaunches through a child session this proxy does not follow, so JavaScript, the Dart CLI adapter and every other language keep the emulation (issue #876).
- A hot restart of a `stopOnEntry: true` Flutter launch stops at entry again: the re-run `main()` hits the entry breakpoint the launch armed, reported as `reason: "entry"` like the first time.
- The launch configuration is replayed verbatim (script, args, `dapLaunchArgs`, `adapterLaunchConfig` — the `testRunner` preset rides in it — `breakOnExceptions`); there are no per-restart overrides — call `start_debugging` for a different configuration.
- **The output buffer starts fresh on a relaunch**: `outputReset: true` signals that `get_output` cursors from the previous launch are stale — read from `since: 0`. A hot restart keeps the buffer (same process): cursors stay valid.
- The hold and its `pending: true` answer are the same as `start_debugging`'s ("When the launch answers" above): a relaunch that has not stopped when the hold elapses answers `running`, and `wait_for_stop` collects its stop. A relaunch that stopped carries the same [stop snapshot](#the-stop-snapshot) (issue #982).
- **Children belong to a run** (the session tree, issues #1081 and #1082): a relaunch closes and removes the previous run's child sessions before it starts and says so with `childrenClosed: n` (JavaScript children are released rather than ended, js-debug cannot end a target it adopted); a child adopted during the new run's hold is listed in `children`, and children released to run undebugged this run are counted in `childrenReleased`, as for `start_debugging` (top level beside `pending`, and in `data`). A hot restart keeps the process and its children: no `childrenClosed`, the children listed.
- Not available for **attach sessions** unless the adapter offers a native restart (a Flutter attach session hot-restarts like a launched one; any other attach session has no launch configuration to replay — detach and re-attach instead), nor for sessions that were never launched, including dry-run-only sessions — call `start_debugging` on the same session instead.

---

### step_over

Steps over the current line, executing it without entering function calls.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.

**Response:**
```json
{
  "success": true,
  "state": "paused",
  "message": "Stepped over",
  "location": { "file": "/path/app.py", "line": 11, "column": 1 },
  "context": {
    "lineContent": "    b = temp",
    "surrounding": [
      { "line": 9, "content": "    temp = a" },
      { "line": 10, "content": "    a = b" },
      { "line": 11, "content": "    b = temp" },
      { "line": 12, "content": "    return a, b" },
      { "line": 13, "content": "" }
    ]
  },
  "snapshot": {
    "frames": [ { "name": "swap", "file": "/path/app.py", "line": 11 } ],
    "changedVariables": { "b": { "before": "20", "after": "10" } }
  }
}
```

A step past a declaration, and a step that leaves a block, in the same shape:

```json
"changedVariables": {
  "total":   { "before": "0", "after": "2" },
  "sum":     { "after": "30", "new": true },
  "doubled": { "before": "2", "gone": true }
}
```

`location` and `context` are best-effort: they appear when the post-step stack trace and the source file could both be read.

The [stop snapshot](#the-stop-snapshot) rides on every landed step (issues #982/#983). Stepping within one
function reports **`changedVariables`** — only what the executed line changed: a value that changed, a
variable that appeared (`new: true`) or one that left scope (`gone: true`) — instead of re-sending the
full `locals`; stepping into a new frame (or any frame-identity change) shows that frame's full `locals`.
An empty `changedVariables: {}` says the line changed nothing visible. A stop whose frame shows no locals
at all carries neither `locals` nor `changedVariables`, so a frame whose every variable left scope says
nothing on that stop. On an adapter that steps once per
token position (Dart), the snapshot is composed once, from the final landing of the repeated step.

When the stop that ended the step was recorded as something other than the step — a breakpoint on the landing
line, or a breakpoint or exception hit before the step completed — the response also carries `stopReason` (and
`rawStopReason` when the adapter's raw reason was normalized, as for [pause_execution](#pause_execution)), and the
message reads `Stepped over; stopped on 'breakpoint' rather than on the step itself (see stopReason)`. When that stop
is on the very line the step was issued from — a lost step whose breakpoint fired again, or a single-line loop — the
message adds `The program is back at the line the step was issued from.` A `pause` reason is reported in
`stopReason` with the plain wording (issue #678; the origin line is read for every adapter, issue #1180). `location` is
the first visible frame, as everywhere else; `threadId` appears when the answer is anchored off the reported thread, and
`note` carries any internal-frame disclosure (`Paused inside an internal frame …`, even with snapshots off or explicit
variable access, issue #1181), any non-boilerplate stop description from the adapter (such as the COBOL shim's
`returned from BUMP-PARA to VIA-TIMES …`, issue #1182), any no-program-frame or stale-build notice, and any structural
fact proved by comparing the step's starting stack with its landing stack (issues #1180, #1184: `step_out` still inside
the function stepped out of or dropping multiple frames, `step_into` entering no function with any policy step-filter
hint, or a fiber/coroutine switch onto a disjoint call stack). A step stop is read plainly and never moves off its own
thread; a step that was ended by a `pause` from elsewhere is read as a pause and may.

#### Pending steps

`step_over`, `step_into`, and `step_out` share one contract. The DAP step request only acknowledges that the debugger accepted the command — where the program lands arrives later, as a `stopped` event — so each tool waits up to ~5s for it. If the step has not paused when that grace window elapses (e.g. stepping over a long-running call, or a step the engine dropped), the call still **succeeds**, with `state: "running"`, a top-level `pending: true`, and no `location`:

```json
{
  "success": true,
  "state": "running",
  "pending": true,
  "message": "Step dispatched; the program is still executing after 5s (e.g. stepping over a long-running call). The session remains 'running' and becomes 'paused' if the step completes; some debug engines can drop a step (see docs/KNOWN_ISSUES.md). Call wait_for_stop to wait, or pause_execution to interrupt."
}
```

The step is not cancelled by the server: the session becomes `"paused"` if it completes, and the session remembers the in-flight step so [`wait_for_stop`](#wait_for_stop) names it (and how long ago it was sent) if the wait also times out (issue #1178) — call `wait_for_stop` to block until the next stop or exit, or call `pause_execution` to interrupt it.

The adapter may append one sentence to that message saying what the step is waiting for. The JavaScript adapter
does so for a session whose steps the server's stepper serves (issues #678, #1130), from what the stepper last
recorded of the step. When that latest record is that the step is walking, or that it left the stack, the step is
known not to be a long-running call, and nothing promises it will pause, so the message opens differently: `Step
dispatched; it has not landed after 5s. The session is 'running': wait_for_stop blocks until the program next
stops or ends, and pause_execution interrupts it.`, followed by the sentence:

- **Walking.** A `step_into` the stepper is walking through skipped code, one engine step at a time (a long walk
  where an engine step is slow: about 44 ms on Linux, issue #1163): `The stepper's last record of this step is that
  it is walking through skipped code (Node internals, node_modules, or files on skipFiles) one engine step at a time:
  it stops the step when your program's code is next on top, and if the walk reaches its limit of 512 engine steps
  first, it steps out toward the nearest frame of your program (with none below it, the program is resumed). A
  breakpoint reached on the way stops the program there, and if the engine loses the step on the way the program
  runs on.` (`pause_execution` while the walk is taking engine steps is answered as your pause. While the program
  is blocked in native code or idle under the pending `step_into`, it stops inside the server's own wake evaluation
  and is reported as a step at `repl:1`: issue #1208.) A walk that reached its limit and is
  stepping out, or one during which js-debug resumed a pause of its own (the step may have been lost with it, issue
  #1162), is no longer recorded as walking and gets no such sentence.
- **Left its frame.** The stepper ended the step by resuming the program: the step left the frame it started in and
  reached skipped code with nothing of your program below it (a function Node called, such as a timer or event
  callback, returned to the event loop), so it will not land, and `wait_for_stop` answers at the next breakpoint or
  when the program ends.

On a launch, a step issued from skipped code that is not recorded as walking instead names the frame and says a step
does not stop there (that sentence follows the `Step dispatched; it has not landed after 5s. …` lead when the stepper
also recorded that it left the stack, and otherwise follows the generic `Step dispatched; the program is still
executing after 5s …` lead above).

A step still executing (a `step_over` of a long call in the function's own frame) gets no sentence. Neither does a
step V8 itself lost (issues #1161, #1174: one that leaves a function through a `return` inside `try … finally`, out of
a `for … of` loop, from a function with a `using` declaration, or from an async generator): the server cannot tell it
from a step still executing, so set a breakpoint where you expect execution to come back. An attach whose steps the
stepper serves (`smartStep: true`) gets the walking and left-its-frame sentences too.
So match a pending step by its `pending: true` flag, not by the message text.

Once a stop has been observed, the stop path owns the answer — a step that demonstrably landed is never reported as pending afterwards, at the cost of the response then being bounded by the stack-trace round trip rather than by the ~5s window. If the debuggee ends before the step pauses, the result is a success with a terminal `state`, `exitCode` when the debuggee reported one (plus `outputTail` on a non-zero exit when program output was captured, issues #1254, #1277), and a truthful message that never claims the step landed — e.g. `"The step did not pause. The program ran to completion (exit code 0)."` or `"The step did not pause: the session ended."` (issues #1177, #1190).

When the debug adapter itself refuses a step request without resuming execution (for example `netcoredbg` refusing `step_out` from an async iterator with `0x80004005`, or JDI refusing an unknown thread ID), the tool returns `success: false` with `state: "paused"` and the session stays paused where it was so inspection, other steps, and `continue_execution` continue to work (issue #1179). Stepping when the session is not paused returns `success: false` with `state` showing the session's actual state; stepping in a terminated session returns an application-level failure (see [Error Handling](#error-handling)).

---

### step_into

Steps into function calls on the current line.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.

**Response:**
```json
{
  "success": true,
  "state": "paused",
  "message": "Stepped into",
  "location": { "file": "/path/app.py", "line": 4, "column": 1 }
}
```

Same ~5s wait and `pending: true` contract as step_over — see [Pending steps](#pending-steps).

**JavaScript** (a launch that steps through skipped code, the default; issue #1130):

- A `step_into` that lands in skipped code (Node internals, `node_modules`, files on `skipFiles`) walks on, one
  engine step at a time, until your code is on top again or the walk has taken 512 engine steps in skipped code;
  then it steps out. The walk has no time bound: the same step lands in the same place on every host. On Linux,
  at about 44 ms an engine step (issue #1163), a long walk outlasts the ~5 s window: the step answers
  `pending: true` with the walking sentence (see [Pending steps](#pending-steps)), and `wait_for_stop` answers
  where it lands. Measured on an Ubuntu 24.04 host with 2 vCPUs under Node 22: the first `console.log` of a process
  lands on the next line after 16.8 to 17.2 s, a later one after 5.4 to 5.9 s, both `pending` first; a custom
  `util.inspect` function behind `console.log` is entered at once, in 4.6 to 4.7 s (on Windows each of these
  answers at once, in under 1 s).
- A line that calls your own function through skipped code lands in that function when the walk reaches it within
  512 engine steps: an `on` or `once` event listener behind `emitter.emit`, an array callback, a route handler from
  inside express, a custom `util.inspect` function behind `console.log`.
- A line whose call stays in skipped code lands where the call returned: the next line, or the line's next
  statement. A walk that came back out by itself answers a plain `Stepped into`; one that took all of its engine
  steps says what is known: `Stepped into. step_into walked 512 engine steps into the call, its limit, and was
  still in skipped code (Node internals, node_modules, or files on skipFiles), so it stepped out. Code of yours
  that the call runs further in, or only schedules (a timer or promise callback), did not stop the step: a
  breakpoint there stops in it. To stop inside the skipped code instead, turn stepping through it off:
  justMyCode: false on a launch, smartStep: false on a launch or an attach.` Where the walk ends inside the ~5 s
  window (Windows) that sentence is in the step's own message. On Linux a 512-step walk answers `pending` with the
  walking sentence first, and the `wait_for_stop` answer that follows (`Paused (step) at …`) carries it in
  `lastStop.text`. A `console.log` line comes back out by itself (measured through the server on Windows:
  about 390 engine steps for the first `console.log` of a process, 130 for a later one).
  A `require` line does not land where the call returned: Node's loader returns through `try … finally`, so
  stepping back out of it is one of the steps V8 loses (issue #1161). The first load of a module of yours is lost
  and the program runs on. On a built-in module or one already loaded (`require('node:fs')`, a second `require` of
  a loaded file) the walk takes its 512 engine steps inside the loader, and the step stops further down the same
  function, with the lines between run, as without the server's stepper (Windows: under 1 s; Linux: `pending`
  first, about 25 s).
  Use `step_over` on a `require` line, or a breakpoint in the module.
- A pause in your code is the landing, on the line the step started from too: on `console.log(a); console.log(b);`
  the step stops at the second statement, and on a one-line `for … of` loop at the header's next position, in the
  first iteration.
- A line that calls native code only (`JSON.stringify`) has nothing to walk into: a plain `Stepped into` on the
  next line.
- A call that only starts a later task (`setTimeout`, a `.then` callback) is not followed: the step lands on the
  next line. Set a breakpoint in the callback to stop there.

See [Stepping and pausing inside dependencies](javascript/README.md#stepping-and-pausing-inside-dependencies-justmycode-skipfiles).

---

### step_out

Steps out of the current function.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.

**Response:**
```json
{
  "success": true,
  "state": "paused",
  "message": "Stepped out",
  "location": { "file": "/path/app.py", "line": 18, "column": 1 }
}
```

Same ~5s wait and `pending: true` contract as step_over — see [Pending steps](#pending-steps).

**JavaScript** (a launch that steps through skipped code, the default; issues #1130, #1161):

- Out of an `async` function the event loop resumed, the step lands in the function that awaits it, in the
  call that awaited: that is the engine's own step. Not for TypeScript compiled for a target below ES2017 (issue
  #1165): there the step does not land in the awaiting function, and the program runs on to the next breakpoint
  or its end.
- The engine loses a step that leaves a function through a `return` that runs a `finally` first: a `return`
  inside `try … finally`, a `return` out of `for … of`, a function with a `using` declaration, and every async
  generator (issues #1161, #1174). The server does not rescue it and sets no temporary breakpoint: the step answers
  `pending: true`, or `"The step did not pause. The program ran to completion (exit code 0)."` when the program ends first, and a `step_over` off the
  end of a `finally` block can stop in the next call of the same function instead of the caller. Set a breakpoint
  on the line where you expect execution to come back, then `continue_execution`.
- Out of a function that nothing of your program called or awaits (a timer callback, a `.then` callback, a
  request handler) there is nowhere of its own to land: the program is resumed, and the answer is the next stop or
  `pending: true`.

See [Stepping and pausing inside dependencies](javascript/README.md#stepping-and-pausing-inside-dependencies-justmycode-skipfiles).

---

### continue_execution

Continues execution until the next breakpoint or program end.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.

**Response:**
```json
{
  "success": true,
  "message": "Continued execution",
  "state": "running"
}
```

`continue_execution` returns as soon as the adapter acknowledges the resume; it does not wait for the next stop. `state` is the session state at that moment — normally `"running"`, and `"paused"` when a breakpoint fired before the acknowledgement arrived. Call [`wait_for_stop`](#wait_for_stop) to block until the program stops again or ends.

**Error Response:**
```json
{
  "code": -32603,
  "message": "MCP error -32603: Failed to continue execution: Managed session not found: {sessionId}"
}
```

---

### wait_for_stop

Blocks until the session next pauses or ends, then says why and where. This is the explicit wait behind every `pending: true` answer and behind `continue_execution`, which returns as soon as the adapter acknowledges the resume — call it instead of polling `list_debug_sessions`.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.
- `timeout` (number, optional): How long to wait, in milliseconds (default `30000`, max `600000`; larger values are clamped). Not a limit on the program: it keeps running under the debugger either way, and its breakpoints and exception filters stay armed. Your MCP client may enforce its own request timeout (60 s is a common default) — keep `timeout` below it (45 s slices are safe under a 60 s cap) and call again on `pending: true`. A wait that must outlast a slow build (a first Flutter Android build, say) is several slices, not one long `timeout`: one long call fails on the client side first (`-32001`), and only that call — the program and its breakpoints are untouched, so the next call resumes the wait.

**Response** (the session is paused — it already was, or a stop arrived during the wait):
```json
{
  "success": true,
  "state": "paused",
  "sessionId": "a4d1acc8-84a8-44fe-a13e-28628c5b33c7",
  "message": "Paused (breakpoint) at /abs/path/app.py:42",
  "lastStop": { "reason": "breakpoint", "threadId": 1, "timestamp": 1791213582583 },
  "location": { "file": "/abs/path/app.py", "line": 42, "column": 1 },
  "context": {
    "lineContent": "    total = price * qty",
    "surrounding": [
      { "line": 41, "content": "def subtotal(price, qty):" },
      { "line": 42, "content": "    total = price * qty" },
      { "line": 43, "content": "    return total" }
    ]
  },
  "snapshot": {
    "frames": [ { "name": "subtotal", "file": "/abs/path/app.py", "line": 42 } ],
    "locals": { "price": "25.0", "qty": "5" }
  }
}
```

**Response** (the program ended):
```json
{
  "success": true,
  "state": "stopped",
  "sessionId": "a4d1acc8-84a8-44fe-a13e-28628c5b33c7",
  "message": "The program exited with code 3. See outputTail (get_output has the full output).",
  "exitCode": 3,
  "outputTail": ["runner error: no test files found", "exiting with code 3"]
}
```

When the program ends with no stop recorded in this launch and line breakpoints were set, the
answer carries the same run-to-completion summary as `start_debugging` (issues #701, #1033): the
message adds "without hitting any breakpoint. Verified but never hit: app.py:3." and
`unhitBreakpoints` lists every line breakpoint it ran past (`{ file, line, verified }`, plus
`requestedLine` when the adapter moved it). A program resumed past a stop keeps the plain message.
So does a session whose child sessions stopped during the run (issue #1128): its message counts
them — "The program ran to completion (exit code 0). Its child sessions stopped 2 times during this
run." — and lists no breakpoint as unhit: which breakpoints a child stopped on is the child's own
record, so the parent cannot say which were missed. The count is of every stop the agent could
see on a child (a breakpoint, an exception, a step), not of breakpoint hits alone.

**Response** (neither happened within `timeout`):
```json
{
  "success": true,
  "state": "running",
  "pending": true,
  "sessionId": "a4d1acc8-84a8-44fe-a13e-28628c5b33c7",
  "message": "The program is still running after 30s without reaching 1 breakpoint(s). Nothing was cancelled: what is armed stays armed, and the session becomes 'paused' when the program gets there. Call wait_for_stop again to keep waiting, or pause_execution to interrupt it."
}
```

**Notes:**

For a JavaScript attach with child debugging off, a pending `wait_for_stop` while
`running`, with a pausing breakpoint armed and no breakpoint-family stop recorded
in this run, appends this clause to `message` (#1288):

> If a breakpoint's code runs only in a process the target starts (a fork or a worker process), this attach does not debug that process: see adapterConfig.autoAttachChildProcesses in the attach_to_process description for what turning that on costs.

- The wait is on the session's state, not on the adapter's raw `stopped` event, so a stop the server resumes by itself — the entry stop of a `stopOnEntry: false` launch — is never reported. The answer is the first stop `list_debug_sessions` would also show.
- A session that is already paused answers at once with its current stop, and asking twice without resuming returns the same stop twice. After `continue_execution` (or a step that answered `pending: true`) the session is `running`, so the next call waits for the next stop.
- `lastStop` is the record `list_debug_sessions` reports: `reason`, `rawReason` when the adapter's own reason was normalized, `threadId`, and `description`/`text` for an exception — emitted as a secret-redacted copy, like variable values (issue #982). `lastStop.exceptionInfo` is filled in a moment after an exception stop — re-query `list_debug_sessions` if it is absent. `location` and `context` are best-effort: they appear when the stack could be read, and `location` is the first visible frame, as for the step tools; `threadId` and `note` appear as for `pause_execution` (a pause collected by the wait is anchored the same way). The [stop snapshot](#the-stop-snapshot) rides on every paused answer; here it carries no `exception` key — `lastStop.description`/`text` already are the exception.
- `exitCode` is present only when the debuggee reported one. When `exitCode` is non-zero and program output was captured on that session's buffer, `outputTail` and the `get_output` clause in `message` appear by the same rule as on [`start_debugging`](#start_debugging) (issues #1254, #1136, #1277; reading only the named session's own buffer without walking the tree). What the adapter read into the program's end joins the answer, its note in `message` and its data beside it under the adapter's own keys — a Flutter `flutter run` whose `deviceId` matched no device answers `requestedDeviceId` and `availableDevices` (`id`, `name`, `kind`, `targetPlatform`, and `supportedByProject: false` when the project has no platform for the device) with a note that says to pass one of them, or flutter's own remedy (issue #877); a key the answer already has is never overwritten by the adapter's data; `list_debug_sessions` carries the same note as `endNote` with the data beside it. A session that ended in an error answers `state: "error"` with the reason in `message`. A finished session keeps answering the same way until it is closed. When a stop landed during the wait and the program ended before it could be inspected — an uncaught exception and the exit arriving together — the ended answer carries that stop as `lastStop`; a stop from before the wait is not repeated.
- `pending: true` sits at the top level, as for the step tools. The message says what the wait is still for: with breakpoints (or `breakOnExceptions: "all"`) armed it names them and says they stay armed, and when a step sent earlier has still not paused it names that step and its age as well (`; a step_out sent 20s ago has not paused`, issue #1178); with nothing armed it promises no pause — the program will stop only for an uncaught exception the debugger catches, or report its exit — so a caller is not sent round a loop that cannot end in a stop. When the launch runs with the debugger off (`dapLaunchArgs.noDebug`, honoured), the message says so and that the wait is for the program's exit; when the launch or attach itself has not completed, it says the session is still starting.
- A session that was never started answers `success: false` (`Nothing to wait for: this session has not been started…`). So does a session closed while the call was waiting, and a `timeout` that is not a positive number.
- Several calls may wait on one session at once. A call whose request is cancelled, or whose client disconnects, releases its wait.

**Sessions with children** (the session tree, issue #1081): a wait on a session observes it and
every descendant — present, or adopted while the wait runs — and answers for the one session a
fixed priority names:

1. the session itself, if it is paused or in error;
2. else the first paused or errored descendant, depth first in adoption order (a child, then its
   own descendants, then the next child);
3. else the session itself, if it has ended;
4. else it keeps waiting — an ended descendant alone never completes an ancestor's wait.

The wait stays level-triggered: nothing is consumed, asking twice answers the same stop twice, two
concurrent waiters agree, and the entry stop the server auto-continues is still never reported. One
consequence: an errored descendant keeps being selected on every later wait until it is closed —
close it to wait past it.

- `sessionId` is on every answer: the selected session's id, equal to the id asked for when the
  session itself is selected and on the pending answer. Everything else in the answer (`lastStop`,
  `location`, `context`, `snapshot`, `threadId`, `note`, `exitCode`, `outputTail`, the `programEnd` data) is the
  ordinary stop answer **for that session**; use `sessionId` for inspection, stepping and
  continuing. An errored descendant answers `state: "error"` with its id and the reason in
  `message` (`Child session <id> ended in an error state…`).
- `children: [{ sessionId, name, state, parentSessionId }]` whenever the asked session has
  descendants: every descendant, depth first in adoption order, each with its state and the session
  that spawned it — the pending answer included.
- `childrenReleased: n` when children reported on that session's connection during this run were
  released to run undebugged (beyond `DEBUG_MCP_MAX_CHILD_SESSIONS`, or an adoption that failed): a
  running total for the run, reset by a relaunch, never consumed. Every answer that carries it —
  paused, pending, ended or in error — ends its `message` with what the number means and why
  (issue #1137): "1 child process was released to run undebugged (child sessions are off: DEBUG_MCP_MAX_CHILD_SESSIONS=0): a breakpoint only it reaches will not hit." At the cap
  it reads "(the tree was at its child-session cap of 32, which DEBUG_MCP_MAX_CHILD_SESSIONS
  raises)". A pending answer's "what is armed stays armed" is therefore never the last word on a
  breakpoint that only a released child could reach.
- A session with no children answers byte-for-byte as before plus `sessionId`. A wait on a child
  answers for the child and its own descendants only.

A wait on the parent answering a child's stop (`sessionId` is the child's):
```json
{
  "success": true,
  "state": "paused",
  "sessionId": "c7e2a9b4-5d1f-4e8a-9b3c-2f6d8a1e0b47",
  "message": "Paused (breakpoint) at /abs/path/child.py:12",
  "lastStop": { "reason": "breakpoint", "threadId": 1, "timestamp": 1791213590211 },
  "location": { "file": "/abs/path/child.py", "line": 12, "column": 1 },
  "context": {
    "lineContent": "    result = work(item)",
    "surrounding": [
      { "line": 11, "content": "def run(item):" },
      { "line": 12, "content": "    result = work(item)" },
      { "line": 13, "content": "    return result" }
    ]
  },
  "snapshot": {
    "frames": [ { "name": "run", "file": "/abs/path/child.py", "line": 12 } ],
    "locals": { "item": "3" }
  },
  "children": [
    { "sessionId": "c7e2a9b4-5d1f-4e8a-9b3c-2f6d8a1e0b47", "name": "Subprocess 48213", "state": "paused", "parentSessionId": "a4d1acc8-84a8-44fe-a13e-28628c5b33c7" }
  ]
}
```

The pending answer lists the tree too, with `sessionId` naming the session asked for:
```json
{ "success": true, "state": "running", "pending": true, "sessionId": "a4d1acc8-84a8-44fe-a13e-28628c5b33c7", "message": "The program is still running after 30s …", "children": [ { "sessionId": "c7e2a9b4-5d1f-4e8a-9b3c-2f6d8a1e0b47", "name": "Subprocess 48213", "state": "running", "parentSessionId": "a4d1acc8-84a8-44fe-a13e-28628c5b33c7" } ] }
```

---

### pause_execution

Pauses a running program. The DAP pause request only acknowledges that the debugger accepted it — the stop arrives later, as an event — so the tool waits up to ~5s for that stop before answering.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.
- `threadId` (number, optional): Thread to pause. Omitted or `0` means "all threads"; because some adapters (e.g. netcoredbg) reject `threadId: 0`, the server then asks the adapter for its thread list and pauses the first thread it reports, falling back to `0` when that request fails or returns nothing.

**Response** (the stop was observed inside the grace window):
```json
{
  "success": true,
  "state": "paused",
  "message": "Paused",
  "stopReason": "pause",
  "location": { "file": "/path/app.py", "line": 42, "column": 1 },  // the first visible frame; if the pause landed inside a hidden internal frame, get_stack_trace's pausedFrame names it
  "context": { "lineContent": "    total += price", "surrounding": ["…"] },
  "snapshot": { "frames": [ { "name": "loop", "file": "/path/app.py", "line": 42 } ], "locals": { "total": "75.0", "price": "25.0" } },
  "data": { "message": "Paused", "stopReason": "pause", "location": { "file": "/path/app.py", "line": 42, "column": 1 } }
}
```

When the pause was reported on a thread with no program frame — on Windows, CodeLLDB reports it on the break-in thread the OS injects while the program's thread sits in `main` (issue #898) — the answer is anchored on the first thread whose stack reaches the program, and says so:
```json
{
  "success": true,
  "state": "paused",
  "message": "Paused",
  "stopReason": "pause",
  "rawStopReason": "exception",
  "location": { "file": "C:\\proj\\examples\\cpp\\pause_test.cpp", "line": 20, "column": 36 },
  "threadId": 45324,
  "note": "The stop was reported on thread 31208 (5: tid=31208), whose 4 frames are all internal/runtime (top: 'DbgBreakPoint'); showing thread 45324 (1: tid=45324), which is in 'main' (…/pause_test.cpp:20)."
}
```
The no-program-frame quotes below are the form shown when no pausing breakpoint
is set. With a pausing line or function breakpoint already set, the advice says
`continue_execution and trigger activity` without suggesting another breakpoint;
the `get_stack_trace` pointer still follows when applicable. Supported logpoints run on and do not
suppress the breakpoint suggestion.

When no thread has a program frame — an idle Node server's pause lands in Node's timer loop (issues #900, #1146) — `location` is that frame and `note` reads `No program frame is active on thread 0: the only frame is internal/runtime (top: 'process.processTimers' <node_internals>/internal/timers:527). The stop landed outside your code: continue_execution and trigger activity, or set a breakpoint.` With no pausing breakpoint set, when the thread has more frames than the one shown, the sentence ends `…or set a breakpoint; get_stack_trace with includeInternals: true lists the frames.` instead (issue #1141); `get_stack_trace` itself never says that, since it only adds the sentence when it hid nothing.

**A Node program that is running nothing** (issue #1146). A pause sent to a program that is executing no JavaScript stays armed in V8 until code runs, and it used to fire inside the debug adapter's own next evaluation in the target: js-debug then resumed it without reporting it, or Node stopped answering its inspector and spun a core. So before it requests a JavaScript pause the server schedules one no-op timer in the target (`setTimeout`, 150 ms, unref'd, no name declared), and the pause lands when that timer fires: `state: "paused"` about 0.2 s after the call, in `process.processTimers`, with the no-program-frame `note` above. On a loaded machine the pause can still land first inside an evaluation js-debug makes on its own account shortly after an attach; the answer is then `paused` on a sourceless `<anonymous>` frame (`<unknown_source>:1`) with the same note, and `continue_execution` carries on from it. Continue and send it work, or set a breakpoint first — a breakpoint set while it is paused binds at once. This holds for `attach_to_process` and for launched programs alike. The pending answer below remains for a program the timer cannot wake: one busy in native code, or one that has replaced `setTimeout`. While such a pause is pending, breakpoint requests are held (see [`set_breakpoint`](#set_breakpoint)). One pause request is in progress per session at a time: a second `pause_execution` sent before the first has answered waits for that answer, and then asks the adapter again; refused, it leaves a first pause that is still pending as it was.

A frame is program code when the adapter's policy does not call it internal **and** it names a source, so it can be opened at a line (issue #1131). A frame the debugger can only name by symbol (`@core::ops::function::FnOnce::call_once`) or not at all (`<unknown_source>`) is not one, whatever its name. A label the adapter itself gives a code unit is a source without a file and does count: Python's `<string>` and `<stdin>` (`python -c`, an embedded interpreter), js-debug's `<eval>/VM12`. When some frame is counted out only for that reason — a `step_out` of a Rust `main` lands in the standard library's start-up shim, which has no debug info — the sentence does not call it runtime (the quote assumes no pausing breakpoint is set): `No program frame is active on thread 4264: all 10 frames are internal/runtime or have no source (top: 'core::ops::function::FnOnce::call_once' @core::ops::function::FnOnce::call_once:6). Code without source is a runtime's or a library's, or your own built without debug information. continue_execution and trigger activity, or set a breakpoint in a source file; get_stack_trace with includeInternals: true lists the frames.` And `location` then carries `unresolvedSource: true`, the flag `get_stack_trace` puts on the same frame: its `file` is a label, not a path. A pause reported on a thread with no program frame moves to a sibling thread that has one, by the same definition.

**Response** (the program had not stopped when the grace window elapsed):
```json
{
  "success": true,
  "state": "running",
  "pending": true,
  "message": "Pause requested; no 'stopped' event within 5s (the program may be blocked in native code or a syscall). The pause is still in effect: the session will report 'paused' once the stop lands. Call wait_for_stop to block until then.",
  "data": {
    "message": "Pause requested; no 'stopped' event within 5s (the program may be blocked in native code or a syscall). The pause is still in effect: the session will report 'paused' once the stop lands. Call wait_for_stop to block until then.",
    "pending": true
  }
}
```

An adapter may append a sentence to that message, so match a pending pause by its `pending: true` flag, not by the
message text. (The JavaScript adapter used to add one about js-debug's own stepper stepping away from a pause that
landed in skipped code; that stepper is off since issue #1130, and a pause lands where the program is, also when
it is asked for while a step is still pending — except when a `step_into` is pending because the program is blocked
in native code or idle, where it stops inside the server's wake evaluation at `repl:1`, issue #1208.)

**Notes:**
- The `"state"` field is the session state at the moment the tool answers: `"paused"` once the stop has been observed, and `"running"` **only on the pending path** — the request was delivered but the program has not stopped yet. On that path, call [`wait_for_stop`](#wait_for_stop) to block until the state flips to `"paused"` when the target next executes code (or poll `list_debug_sessions`).
- `pending`, `message`, `stopReason`/`rawStopReason`, `location`, `threadId`, `note` and `context` sit at the top level, as for the step tools and `wait_for_stop`; `data` keeps the controller's own copy (issue #906).
- `location` is best-effort: it appears on the observed path when the post-stop stack trace could be read, and is the first visible frame. `threadId` is present only when the answer is anchored on a thread other than the one the stop was reported on (and the stop named a thread), and `note` says why: a `pause` reported on a thread with no program frame moves to the first sibling whose stack reaches the program (issue #898), or, when no thread has one, says that no program frame is active (issue #900). Breakpoint, step, exception and entry stops stay on the thread they were reported on.
- When the stop is observed before the tool returns, `data.stopReason` carries the (normalized) stop reason and — if the adapter reported a misleading raw reason that was normalized — `data.rawStopReason` carries the original. Example: CodeLLDB delivers an explicit pause via SIGSTOP and reports `"exception"`; the result is `stopReason: "pause", rawStopReason: "exception"`. js-debug similarly reports pauses as `"step"`. The same raw reason appears as `lastStop.rawReason` in `list_debug_sessions`. Stale stops from before the pause request are never echoed.
- The observed path carries the [stop snapshot](#the-stop-snapshot) beside the landing (issue #982).
- The session must be in a `"running"` state; pausing an already-paused session returns success immediately with `"Already paused"` (plus the current `stopReason`) — no landing read and no snapshot on that fast path; `wait_for_stop` answers at once with both for the current stop. Any other state fails with `Cannot pause in state: <state>`.
- If the debuggee ends before the pause takes effect, the call still succeeds, reporting `"Session ended before pause took effect"`.
- A session with no debuggable target to pause (e.g. a JavaScript attach whose target session was never adopted, or has ended) fails with an actionable error instead of hanging.
- After pausing, you can inspect variables, evaluate expressions, and step through code

---

## State Inspection

### Secret redaction

Debuggers see everything in scope — including credentials — and when the debugging driver is an AI agent, variable values flow into model context and transcripts. By default, mcp-debugger masks credential-shaped values in every value-bearing surface: `get_variables`, `get_local_variables`, `evaluate_expression` results, captured output (`get_output` and the `debug://sessions/{id}/output` resource), the [stop snapshot](#the-stop-snapshot)'s locals and exception, and the stop record (`lastStop` as `wait_for_stop`, `get_stack_trace` and `list_debug_sessions` emit it — an exception message can carry a token too, issue #982).

Masking is per-token and labeled, so the rest of the value stays legible:

```json
{ "name": "gh_token", "value": "<redacted:github-pat>", "type": "str", "redacted": true }
```

Two detection layers apply:

- **Value shapes** — well-known token formats (GitHub/GitLab PATs, OpenAI/Anthropic-style `sk-` keys, Slack, Stripe, AWS access key IDs, Google API keys, npm/PyPI/Hugging Face tokens, SendGrid, JWTs, PEM private-key blocks, `Bearer` credentials, connection-string passwords, URL userinfo passwords). Patterns are adapted from the MIT-licensed [gitleaks](https://github.com/gitleaks/gitleaks) corpus.
- **Sensitive names** — a variable whose *name* exactly matches a known sensitive name (`password`, `api_key`, `client_secret`, ...) has its whole value masked as `<redacted:sensitive-name>`, unless the value is trivial (`None`, `''`, `0`, ...) so "why is my token empty?" stays debuggable. Matching is exact after normalization, never substring — `tokenCount`, `PATH`, and `patience` are untouched. `evaluate_expression` treats the expression's final dot-segment as the name, so `config.password` is masked like the variable `password`.

Results that had values masked carry a `redaction` field (`{ masked, notice }` on variable/output tools; `{ rules, notice }` on evaluate results) explaining that only the display is masked, not program state. Redacted variables and output entries are flagged `redacted: true`.

**Opting out**: start the server with `DEBUG_MCP_NO_REDACT=1` to disable redaction entirely (e.g. when debugging credential-handling code itself). Adapter stderr sanitization (unconditional, whole-line) is unaffected by this flag.

**Logs**: the server's per-process log and the per-session proxy log (both under the temp directory, outliving the session) record a debuggee output event by its category and length only; the text itself is written only at `--log-level debug`, masked the same way `get_output` is. Other DAP event bodies are logged after the same sanitization as request payloads (environment blocks counted, token-shaped values masked).

**Limitations**: redaction is display-level protection against credentials leaking into transcripts, not a security boundary against a hostile agent — an agent can still compute over secrets via `evaluate_expression` side effects. Secrets split across separate output chunks, and generic high-entropy strings with no recognizable shape or name, are not detected. The [`expose_session`](#expose_session) IDE mirror shows **raw, unredacted** values — it serves a human's IDE, not the agent.

### Least-privilege mode

For security-sensitive deployments, `DEBUG_MCP_VARIABLE_ACCESS=explicit` disables bulk scope dumps: `get_variables` and `get_local_variables` **require** a `names` filter, so the agent must ask for specific variables instead of sweeping every value in scope into its context. An unfiltered call is rejected with a clear `InvalidParams` error that teaches the correct call shape; the tool schemas and the initialize instructions advertise the requirement.

The `names` parameter works in the default (`open`) mode too, as an ordinary filter:

- Exact-match and **case-sensitive** against variable names (DAP names are language identifiers).
- The response's `notFound` array lists requested names absent from the scope, so "filtered out" is distinguishable from "doesn't exist".
- Unrequested values are dropped in the session layer, before redaction and logging.

`evaluate_expression` is deliberately **not** restricted in explicit mode: least-privilege guards against indiscriminate bulk exposure, not against a determined agent — evaluate is already explicit-by-name, per-request, and audit-logged, which is exactly the access discipline the mode enforces, and removing the core debugging primitive would make the mode unusable. [Secret redaction](#secret-redaction) still applies to evaluate results.

### get_stack_trace

Gets the current call stack.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.
- `threadId` (number, optional): Inspect a specific thread from `list_threads`. A frame-bearing explicit thread becomes the anchor for follow-up scopes, locals, and evaluation calls.
- `includeInternals` (boolean, optional): Include runtime/framework frames. Defaults to `false`.

**Response:**
```json
{
  "success": true,
  "threadId": 1,
  "stackFrames": [
    {
      "id": 3,
      "name": "swap_variables",
      "file": "C:\\path\\to\\debug-mcp-server\\examples\\python_simple_swap\\swap_vars.py",
      "line": 5,
      "column": 1
    },
    {
      "id": 4,
      "name": "main",
      "file": "C:\\path\\to\\debug-mcp-server\\examples\\python_simple_swap\\swap_vars.py",
      "line": 21,
      "column": 1
    },
    {
      "id": 2,
      "name": "<module>",
      "file": "C:\\path\\to\\debug-mcp-server\\examples\\python_simple_swap\\swap_vars.py",
      "line": 30,
      "column": 1
    }
  ],
  "count": 3
}
```

**Notes:**
- Stack frames are ordered from innermost (current) to outermost
- `threadId` identifies the thread represented by `stackFrames`, or the explicitly queried thread when the stack is empty. `lastStop.threadId`, when present, remains the thread reported by the original stop event.
- `stopReason` and `lastStop` describe the pause the frames were read at, so they are omitted whenever the session is not paused; they are taken from the state at the start of the call, so a `continue_execution` racing the fetch does not strip them from an answer that really was read at a stop.
- Frame IDs are used with `get_scopes`
- Internal/runtime frames (e.g. Node.js internals and `node_modules` dependencies, Go `/runtime/`, `System.*`) are filtered out by default; pass `includeInternals: true` to see them. When any frames were hidden, the response additionally carries `hiddenFrames` (count) and a `note` explaining how to reveal them.
- When the top frame's file is a source the adapter binds through a compiled file that is older than it — a `.ts` through its generated `.js`, a `.java` through its `.class`, a `.cs` through the launched DLL, a native source through the executable the launch runs — the `note` ends with the stale-build sentence `set_breakpoint` warns with (issues #938, #950, #951): the line shown comes from the newer source and may not be the statement that runs. The top frame only, and not one whose `file` is a `<…>` label or that carries `unresolvedSource: true`; the same hedge applies as for `set_breakpoint` (mtimes only).
- A frame the exception at this stop has already left carries `unwound: true` (issue #1143): its variables are readable, but execution is not in it and a step does not continue from it. The first frame without the flag is where the program is paused, and `note` says both: `The exception was raised in 'check_positive', which has already unwound: its variables are readable. Execution is paused in 'test_assert_in_helper' (test_billing.py:20); a step continues from there.` Python is the one adapter that reports such frames (pydevd, at a user-unhandled exception stop such as a failing pytest test whose exception was raised in a helper); a stop whose frame 0 is live carries no flag and no such note. The same flag rides on `snapshot.frames` and on the `frame` of `get_local_variables` and `evaluate_expression`. Frame names are the functions' names: pydevd's ` (Current frame)` suffix, which used to mark the live frame, is gone.
- When frames were hidden but none of the ones listed is program code — they have no source (issue #1131) — `noProgramFrame: true` is set and the `note` carries the no-source form of the `No program frame is active…` sentence beside the hidden-frames count.
- A frame with no openable source path on this host carries `unresolvedSource: true` — here, on the stop answers' `location` and `snapshot.frames`, and on the `frame` of `get_local_variables` and `evaluate_expression` (issue #1131) — and the `note` says its `file` is a label rather than a path — do not pass it to `get_source_context` — then adds what such a frame is under the session's adapter (issue #816): js-debug — a source-mapped `.ts` the package did not ship, with the switch that shows the generated `.js` paths instead (`adapterConfig.sourceMaps: false` on attach, `adapterLaunchConfig.sourceMaps: false` on launch); CodeLLDB (C/C++, Rust, COBOL) — a native frame without debug info (system libraries, CRT start-up) that the debugger names by symbol (`@NtWaitForSingleObject`), or a runtime built elsewhere whose relative path is not present here, where the program's own frames are the ones with a full path; Java — a class the JDI bridge names by package path (`java/io/PrintStream.java`) because its source is under none of the source roots the bridge knows (issue #1138: `sourcePaths`, or a line breakpoint in a file of the same source tree, shows it one; the JDK's own classes have no source on this host). Adapters with nothing to add leave the neutral sentence alone.
- The filtered stack is never empty when the adapter reported frames: if *every* frame is internal (e.g. a goroutine paused inside the Go runtime), the top internal frame is kept so `get_scopes`/`evaluate_expression` still have a valid `frameId`, and the `note` says so.
- When the frame the debuggee is paused in is itself internal (a breakpoint or step that landed inside a `node_modules` dependency, say) while user frames survive further down, the response carries `pausedFrame` (`id`, `name`, `file`, `line`, and `kept`). On a breakpoint or step stop (a `debugger;` statement counts), or when an async boundary separates the paused frame from the first visible one (nothing below it can be evaluated), the paused frame is kept as `stackFrames[0]` so locals and evaluation anchor where the program actually stopped; `hiddenFrames` counts only the frames that stayed hidden. After a `pause` or an exception with a synchronous caller visible — stops that routinely land in runtime frames where the first user frame is the useful one — it stays hidden (`kept: false`) and the `note` names it; use `pausedFrame.id` as the `frameId` to inspect it (issue #672).
- When a `pause` is reported on a thread whose every frame is internal (on Windows, CodeLLDB reports `pause_execution` on the break-in thread the OS injects, an ntdll-only stack, while the program's thread sits in `main`), the default stack is the first thread whose stack reaches the program instead, and `note` says which thread the stop was reported on and which is shown (issue #898). Breakpoint, step, exception and entry stops stay on the thread they were reported on. Passing `threadId` always shows that thread and anchors the session there; the next `threadId`-less read on the same pause moves back and says so. Once the session is anchored off the reported thread (this, or an attach that moved off the break-in thread), every `threadId`-less read notes `The stop was reported on thread X; inspection is anchored on thread Y.`
- When an explicit thread reports no frames, the response remains anchored to that thread and its `note` suggests a frame-bearing alternative when one is available.
- When the implicit stopped thread is frameless, stack, locals, and default evaluation share one resolver. It scans siblings, prefers a thread whose frames the language policy recognizes as user code over runtime-only stacks, adopts it once, and discloses the switch in `note`/`anchorNote`.
- An empty stack on a paused thread is explained by the adapter's own reading where it has one (issue #1132). Dart: `The isolate is idle between events (waiting in an `await`), so no Dart frame is on its stack; it is not in native code, and pausing again lands in the same idle state. To stop where the program runs next, set a breakpoint in the code that runs next (the loop body, a handler or a callback) and continue_execution; wait_for_stop answers when it is hit.` That answer comes at once: an empty first read is an idle isolate, so the 3 s wait other adapters get for a stack that has not materialised yet is not spent. The same note is on the `pause_execution`, attach and `wait_for_stop` answers that land there.
- Failed or empty stack responses include the session's optional `diagnostics` when the proxy failed, matching `list_debug_sessions`.

---

### get_scopes

Gets variable scopes for a specific stack frame.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.
- `frameId` (number, required): The ID of the stack frame from `get_stack_trace`.

**Response:**
```json
{
  "success": true,
  "scopes": [
    {
      "name": "Locals",
      "variablesReference": 5,
      "expensive": false,
      "presentationHint": "locals",
      "source": {}
    },
    {
      "name": "Globals",
      "variablesReference": 6,
      "expensive": false,
      "source": {}
    }
  ]
}
```

**Important:**
- The `variablesReference` is what you pass to `get_variables` as the `scope` parameter
- This is NOT the same as the frame ID!

---

### get_variables

Gets variables within a scope.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.
- `scope` (number, required): The `variablesReference` number from a scope or variable.
- `names` (string[], optional): Only return variables with these exact names (case-sensitive). Requested names missing from the scope are listed in the response's `notFound`. Required in [least-privilege mode](#least-privilege-mode).

**Response:**
```json
{
  "success": true,
  "variables": [
    {
      "name": "a",
      "value": "10",
      "type": "int",
      "variablesReference": 0,
      "expandable": false
    },
    {
      "name": "b",
      "value": "20",
      "type": "int",
      "variablesReference": 0,
      "expandable": false
    }
  ],
  "count": 2,
  "variablesReference": 5
}
```

**Variable Properties:**
- `variablesReference`: 0 for primitive types, >0 for complex objects that can be expanded
- `expandable`: Whether the variable has child properties
- Values are always returned as strings

**Size guards (issues #356/#359):** responses are capped so an enormous scope (e.g. a JS internal frame reaching `process`/`global`) can't exceed an MCP client's per-result size limit. Per variable, values longer than 1024 chars are cut and flagged `truncated: true`; per call, at most 300 variables (256KB total) are returned. When anything was cut, the response carries a top-level `truncation` object — `{ omittedCount, valueTruncatedCount, notice }` — and the `names` filter is the escape hatch to fetch specific variables in full. Limits are env-overridable: `DEBUG_MCP_MAX_VARIABLE_VALUE_CHARS`, `DEBUG_MCP_MAX_VARIABLES`, `DEBUG_MCP_MAX_VARIABLES_TOTAL_CHARS`.

---

### get_local_variables

Gets local variables for the session's shared inspection anchor. It walks down from the top frame and **stops at the first frame that yields usable locals**, then applies the language adapter's policy to that frame's scopes. Closures and outer-scope bindings come from fanning out across that one frame's scopes (Local, Block, Closure, Module), not from collecting every frame in the stack — walking past the answer is both wasteful and unsafe, since an unrelated lower-frame formatter can hang the whole inspection. When the anchor is not the top frame, `frame` names the one that was used. A convenience over calling stack→scopes→variables by hand.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.
- `includeSpecial` (boolean, optional): Include special/internal variables like `this`, `__proto__`, `__builtins__`, etc. Default: false.
- `names` (string[], optional): Only return variables with these exact names (case-sensitive). Requested names missing from the extracted locals are listed in the response's `notFound`. Required in [least-privilege mode](#least-privilege-mode).

**Response:**
```json
{
  "success": true,
  "variables": [
    {
      "name": "x",
      "value": "10",
      "type": "int",
      "variablesReference": 0,
      "expandable": false
    },
    {
      "name": "y",
      "value": "20",
      "type": "int",
      "variablesReference": 0,
      "expandable": false
    }
  ],
  "count": 2,
  "frame": {
    "name": "main",
    "file": "C:\\path\\to\\script.py",
    "line": 31
  },
  "scopeName": "Locals"
}
```

**Size guards:** same caps and `truncation` advisory as [get_variables](#get_variables); additionally, the multi-frame scope fan-out stops issuing DAP requests once the per-call variable budget is spent (`truncation.scopesSkipped` reports scopes never fetched). Top-frame scopes are fetched first, so the locals that matter are unaffected. The `truncation` counts describe only the returned payload — values cut while fetching fan-out scopes the policy then discarded (e.g. Global/Closure) are not reported (issue #438).

If the originally stopped thread has no frames, this tool uses the same user-frame-preferring adopted anchor as `get_stack_trace`. The response's `note` always names an automatic thread or lower-frame switch.

**When no frame is program code** (issue #1135) — a pause on a launched Node program idle between timers, which lands in the timer loop; a `step_out` of `main`, which lands in the C runtime — the answer still carries the variables the adapter reported for `frame`, and says whose they are: `noProgramFrame: true`, and a `note` with the sentence the pause or step answer gave for that stop (`No program frame is active…`) plus one clause naming the frame. When the paused thread has no frames at all, `note` carries what the stack read said about that (under Dart: the isolate is idle between events, issue #1132) and `message` adds no remedy of its own; the generic one (`Try get_stack_trace with a threadId from list_threads…`) appears only when the stack read had nothing to say. When the frame is counted out for having no source rather than for being runtime (issue #1131), the clause reads `The variables shown belong to '<frame>', a frame without source.`

A variable with no name is not listed under CodeLLDB's own locals (Rust and C/C++; issue #1131): after a `step_out` of a function that returns nothing, the adapter reports the returned value as a nameless `void` entry (`()` or `<Unable to determine byte size.>`). `includeSpecial: true` shows it, as it shows everything the adapter reported. COBOL is not affected: its locals are the data division, which the shim serves. When the top frame has nothing else, the read walks down to the first frame with locals as usual; its note calls the top frame `runtime/stdlib` only when the adapter's policy does.

This example has no pausing breakpoint set.

```json
{
  "success": true,
  "variables": [ { "name": "now", "value": "4210", "type": "number", "variablesReference": 0, "expandable": false } ],
  "count": 1,
  "frame": { "name": "process.processTimers", "file": "<node_internals>/internal/timers", "line": 527 },
  "scopeName": "Local: processTimers",
  "noProgramFrame": true,
  "note": "No program frame is active on thread 0: the only frame is internal/runtime (top: 'process.processTimers' <node_internals>/internal/timers:527). The stop landed outside your code: continue_execution and trigger activity, or set a breakpoint. The variables shown belong to 'process.processTimers', not to your program."
}
```

The clause is left out when the list is empty. The [stop snapshot](#the-stop-snapshot) of such a stop carries no `locals` at all: it is orientation, and a runtime frame's variables are not; this tool is the explicit read.

**Example - Python:**
```json
// Request
{
  "sessionId": "842ef9bb-037a-4d3c-960c-ad79a63ccfab",
  "includeSpecial": false
}

// Response
{
  "success": true,
  "variables": [
    {"name": "x", "value": "10", "type": "int", "variablesReference": 0, "expandable": false},
    {"name": "y", "value": "20", "type": "int", "variablesReference": 0, "expandable": false}
  ],
  "count": 2,
  "frame": {
    "name": "main",
    "file": "C:\\path\\to\\test-scripts\\python_test_comprehensive.py",
    "line": 31
  },
  "scopeName": "Locals"
}
```

**Example - JavaScript:**
```json
// Request
{
  "sessionId": "ec46719a-68d9-4755-9c28-70478e0cde7d",
  "includeSpecial": false
}

// Response
{
  "success": true,
  "variables": [
    {"name": "x", "value": "10", "type": "number", "variablesReference": 0, "expandable": false}
  ],
  "count": 1,
  "frame": {
    "name": "main",
    "file": "c:\\path\\to\\test-scripts\\javascript_test_comprehensive.js",
    "line": 40
  },
  "scopeName": "Local"
}
```

**Edge Cases:**
```json
// Empty locals
{
  "success": true,
  "variables": [],
  "count": 0,
  "frame": {"name": "<module>", "file": "script.py", "line": 2},
  "scopeName": "Locals",
  "message": "The Locals scope is empty."
}

// Session not paused
{
  "success": false,
  "error": "Session is not paused",
  "message": "Cannot get local variables. The session must be paused at a breakpoint."
}
```

**Key Advantages:**
- **Single Call**: Get local variables with one tool call instead of three (stack_trace → scopes → variables)
- **Language-Aware Filtering**: Automatically filters out internal/special variables based on language
- **Consistent Format**: Returns a consistent structure across Python and JavaScript
- **Smart Defaults**: By default, excludes noise like `__proto__`, `this`, `__builtins__` unless explicitly requested

**Language-Specific Behavior:**
- **Python**: Looks for "Locals" scope, filters out `__builtins__`, special variables, and internal debugger variables
- **JavaScript**: Merges every block scope on the frame — js-debug names them `Block`, `Catch Block`, `With Block` (or the legacy `Block:<label>`) — ahead of the frame's `Local` scope, innermost block first, so a `let` declared in a `for` body or a `catch (e)` binding is returned alongside the function's own locals and shadows them in the order JavaScript does (#558). `scopeName` stays `Local` with no `note` whenever the frame has a Local scope and any block or local scope produced variables, even if `Local` itself contributed nothing. On an ESM top-level frame (blocks but no `Local`), the frame's `Module`/`Script` scope joins the merge as its base and `scopeName` is the block. An empty Local/block frame may fall through to Closure or Module on that same frame. A frame with no Local or block scope returns empty variables and an `anchorNote` directing you to `get_scopes`/`get_variables`; Global is never mislabeled as locals. Filters out `this`, `__proto__`, and V8 internals.
- **Ruby**: Reads rdbg's "Local variables" scope, hiding the `%self` pseudo-variable unless `includeSpecial: true`; a frame whose only local is `%self` (a native `[C]` frame) counts as empty
- **Other Languages**: Falls back to generic behavior (first non-global scope)

**Notes:**
- Session must be paused at a breakpoint for this tool to work
- The tool walks down from the top frame only until a frame yields usable locals, then uses the adapter policy to extract them from that frame's scopes
- When the top frame has no usable locals (a runtime/stdlib frame, a `sleep`), the response anchors to the first lower frame that does, `frame` names that frame, and `note` explains the switch; `note` also reports a same-frame scope fallback (e.g. JavaScript Local → Module). Pass `names` to disable the frame walk-down
- At a breakpoint or step inside a frame the stack display hides as internal (a dependency under `node_modules`), the anchor is that frame — the one the program actually stopped in — and `note` says it was kept. After a `pause` inside such a frame the anchor stays on the first visible frame and `note` names the hidden paused frame and its `frameId` (issue #672)
- When `includeSpecial` is true, all variables including internals are returned
- This is especially useful for AI agents that need quick access to current local state

---

### evaluate_expression

Evaluates an expression in the context of the current debug session.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.
- `expression` (string, required): The expression to evaluate.
- `frameId` (number, optional): Authoritative stack frame ID for context. If omitted, evaluation uses the same adopted top frame as `get_stack_trace` and `get_local_variables` — at a breakpoint or step that is the frame the program stopped in even when the default stack display would hide it as internal (issue #672). `anchorNote` explains an automatic thread switch and any paused-frame decision (kept or hidden), and `frame` names the frame that was actually used — on failure too, so an `Unable to evaluate on async stack frame` error says which frame it tried. Compare `frame` with `get_stack_trace`'s `pausedFrame` to tell whether the evaluation ran in the frame the program stopped in.
- `timeout` (number, optional): Maximum time in milliseconds to wait for the evaluation to complete (default: 30000, max: 600000). On expiry the request fails but the expression may keep executing in the debuggee.

**Response:**
```json
{
  "success": true,
  "result": "10",
  "type": "int",
  "variablesReference": 0,
  "presentationHint": {},
  "frame": { "name": "swap_variables", "file": "C:\\path\\to\\swap_vars.py", "line": 5 }
}
```

`frame` is present when `frameId` was omitted and names the frame the expression ran in (the same shape `get_local_variables` reports).

When `frameId` was omitted and no frame of the stack is program code (issue #1135), the answer also carries `noProgramFrame: true`, and `anchorNote` ends with the sentence the pause or step answer gave for that stop (`No program frame is active…`) and `The expression was evaluated in that frame.` — the expression ran in a runtime frame (Node's timer loop, the C runtime's start-up) or one without source (issue #1131), where your program's names do not resolve. An explicit `frameId` is the caller's choice and adds nothing.

**Example - Simple Variable:**
```json
// Request (no frameId needed!)
{
  "sessionId": "d507d6fb-45fc-4295-9dc0-4f44b423c103",
  "expression": "x"
}

// Response
{
  "success": true,
  "result": "10",
  "type": "int",
  "variablesReference": 0
}
```

**Example - Arithmetic Expression:**
```json
// Request
{
  "sessionId": "d507d6fb-45fc-4295-9dc0-4f44b423c103",
  "expression": "x + y"
}

// Response
{
  "success": true,
  "result": "30",
  "type": "int",
  "variablesReference": 0
}
```

**Example - Complex Expression:**
```json
// Request
{
  "sessionId": "d507d6fb-45fc-4295-9dc0-4f44b423c103",
  "expression": "[i*2 for i in range(5)]"
}

// Response
{
  "success": true,
  "result": "[0, 2, 4, 6, 8]",
  "type": "list",
  "variablesReference": 4  // Can be expanded to see elements
}
```

**Error Handling:**
```json
// Request - undefined variable
{
  "sessionId": "d507d6fb-45fc-4295-9dc0-4f44b423c103",
  "expression": "undefined_variable"
}

// Response
{
  "success": false,
  "error": "Name not found: Traceback (most recent call last):\n  File \"<string>\", line 1, in <module>\nNameError: name 'undefined_variable' is not defined\n"
}
```

**Important Notes:**
- **Automatic Frame Detection**: When `frameId` is not provided, the tool automatically gets the current frame from the stack trace
- **Side Effects Are Allowed**: Expressions CAN modify program state (e.g., `x = 100`). This is intentional and useful for debugging
- **Session Must Be Paused**: The debugger must be stopped at a breakpoint for evaluation to work
- **Results Are Strings**: All results are returned as strings, even for numeric types
- **Python Truncation**: Python/debugpy automatically truncates collections at 300 items for performance

---

### get_source_context

Gets source code context around a specific line in a file.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.
- `file` (string, required): Path to the source file — **absolute** in host mode (a relative path is rejected); in container mode, relative to the `/workspace` mount.
- `line` (number, required): Line number to get context for (1-indexed).
- `linesContext` (number, optional): Number of lines before and after to include (default: 5).

**Response:**
```json
{
  "success": true,
  "file": "C:\\path\\to\\script.py",
  "line": 15,
  "lineContent": "    result = calculate_sum(x, y)",
  "surrounding": [
    { "line": 12, "content": "def main():" },
    { "line": 13, "content": "    x = 10" },
    { "line": 14, "content": "    y = 20" },
    { "line": 15, "content": "    result = calculate_sum(x, y)" },
    { "line": 16, "content": "    print(f\"Result: {result}\")" },
    { "line": 17, "content": "    return result" },
    { "line": 18, "content": "" }
  ],
  "contextLines": 3
}
```

**Example:**
```json
{
  "sessionId": "a4d1acc8-84a8-44fe-a13e-28628c5b33c7",
  "file": "C:\\path\\to\\test_script.py",
  "line": 25,
  "linesContext": 3
}
```

**Notes:**
- Useful for AI agents to understand code structure without reading entire files
- Returns the requested line content and surrounding context
- Handles file boundaries gracefully (won't return lines before 1 or after EOF)
- Uses efficient line reading with LRU caching for performance

---

### get_output

Gets the debuggee's output (stdout/stderr/console) captured for a session. Output is delivered by the debug adapter as DAP `output` events and buffered per launch (issue #218).

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.
- `since` (number, optional): Sequence cursor — only entries with `seq` greater than this are returned. Pass `nextSince` from the previous response to fetch only new output. Default: `0` (start of the buffer).
- `limit` (number, optional): Maximum entries to return (default: 100, max: 1000).

**Response:**
```json
{
  "success": true,
  "sessionId": "a4d1acc8-84a8-44fe-a13e-28628c5b33c7",
  "entries": [
    { "seq": 1, "category": "stdout", "output": "Factorial of 5: 120\n", "timestamp": 1754140800123 },
    { "seq": 2, "category": "stderr", "output": "warning: deprecated\n", "timestamp": 1754140800345 }
  ],
  "nextSince": 2,
  "hasMore": false,
  "dropped": 0
}
```

**Notes:**
- The buffer holds the last 1000 entries per launch; older entries are evicted and counted in `dropped`. Individual entries longer than 8192 characters are cut and flagged `"truncated": true`.
- Adapter-internal `telemetry` events are filtered out at capture time, as are output events an adapter policy declares to be pure adapter noise — e.g. LLDB's harmless DWARF-parser error spew on MinGW-built rust/cpp binaries (issue #361); suppressed lines remain visible in debug logs. All other categories (`stdout`, `stderr`, `console`, `important`, ...) are kept. Adapters that omit a category default to `console`.
- Works while the program is running and after it finishes — output stays readable until `close_debug_session`. Re-launching a session starts a fresh buffer (seq restarts at 1).
- A child session of a JavaScript **launch** (the session tree, issue #1082) answers `outputOn: <launch session id>` with a `note`: js-debug attributes no stdout or stderr to a child. What the child writes to inherited stdio arrives on the launch session's connection, so the launch session's buffer is where those lines are; what it writes to a pipe (`fork` with `silent: true`, `spawn` with `stdio: 'pipe'`) is read by its parent process and by no session. The note says both. The child's own `entries` are what the debugger produced for that process: the lines of the logpoints it hit (issue #1212) and notices (its resource reads the same way, a pointer line first). A debugpy child and a child of a JavaScript **attach** carry their own lines (an attach owns no pipes; js-debug's console capture then lands on each process's own connection) and answer no `outputOn`.
- A session with child sessions answers `children`: the list `wait_for_stop` and the launch answers carry (`sessionId`, `name`, `state` and `parentSessionId` of every descendant). A logpoint's line is on the session of the process that hit it, so this is where a caller reading the launch session learns which other sessions to read (issue #1212). A session with no children has no such field.
- `hasMore: true` means more entries matched than `limit` allowed; call again with `since: nextSince`.
- Incremental polling recipe: call once, remember `nextSince`, and pass it as `since` on the next call — you'll only ever see new output.
- Adapter support: Python (`redirectOutput`), JavaScript (`outputCapture: 'std'`), Go (`outputMode: 'remote'`), and Java forward debuggee stdio as output events; .NET typically does as well. Ruby launch mode and Rust on Windows route debuggee stdio to the adapter process; the proxy forwards those lines as synthesized `stdout`/`stderr` events (#222/#223), excluding rdbg's `DEBUGGER:` banners. Ruby **attach** captures nothing — the target's stdio stays wherever the process was started.

#### Output resources & subscriptions

Each session also exposes its captured output as an MCP resource:

- **URI:** `debug://sessions/{sessionId}/output` (`text/plain`) — the verbatim console transcript (all categories interleaved in arrival order).
- **`resources/list`** enumerates one output resource per session; the list changes on session create/close (`notifications/resources/list_changed`).
- **`resources/subscribe`** to a session's URI to receive `notifications/resources/updated` pings as output arrives. Pings are coalesced (~150 ms), so notification volume is independent of how fast the debuggee prints — on a ping, re-read the resource or call `get_output` with your cursor.
- Subscriptions are tracked per MCP connection and cleaned up when the connection closes or the session is removed; the coalesced pings are fanned out to every connection that subscribed.

After a launch or attach creates its run directory, `resources/list` also includes `debug://sessions/{sessionId}/proxy-log`. Reading it returns at most the final 64 KiB, sanitized and trimmed to 80 lines. It is a point-in-time diagnostic resource and is intentionally not subscribable; output remains the only resource that emits update notifications.

---

## Additional Tools

### list_supported_languages

Lists all supported debugging languages with metadata.

**Parameters:** None (empty object `{}`)

**Response:**
```json
{
  "success": true,
  "installed": ["python", "ruby", "mock"],
  "available": [
    {
      "language": "ruby",
      "package": "@debugmcp/adapter-ruby",
      "installed": true,
      "modes": {
        "launch": { "supported": true, "available": false, "reason": "Ruby executable not found..." },
        "attach": { "supported": true, "available": true, "by": ["port"] }
      }
    }
  ],
  "languages": [
    {
      "id": "python",
      "displayName": "Python",
      "version": "1.0.0",
      "requiresExecutable": true,
      "defaultExecutable": "python"
    }
  ],
  "count": 3
}
```

**Notes:**
- `installed[]` keeps its historical meaning: adapter package present on disk (the metadata probe) and not disabled. `count` is its length. Whether the package can actually be used is what `modes` says.
- `available[]` carries one entry per known adapter, with per-mode availability (issue #331) and a `description` when the adapter registry supplies one. `supported` says whether the adapter implements the mode at all; `available` says whether it is usable in this runtime right now (with a `reason` when it isn't).
- When the adapter package is present but importing it failed — a dependency it imports is missing from the distribution, say (issue #795) — both modes read `available: false` with the loader's own words as the `reason`: `Failed to load adapter for '<lang>' from package '@debugmcp/adapter-<lang>'. The package is installed but importing it failed: Cannot find package '<dep>' imported from … — its dependency '<dep>' is missing or broken. Reinstall it (npm install @debugmcp/adapter-<lang>) or rebuild it.` `create_debug_session` and `start_debugging` refuse with the same reason, and `mcp-debugger doctor` reports the language as broken. A genuinely absent package reads `Adapter package @debugmcp/adapter-<lang> is not installed.` on the modes, and the loader's `Adapter not installed. Install with: npm install @debugmcp/adapter-<lang>` when a launch is attempted anyway.
- Attach for Python and Ruby is a direct connection to a debugpy/rdbg DAP socket, so it stays available even when the local toolchain is missing — the container image uses exactly this to offer Ruby attach without a Ruby runtime.
- Disabled languages (`DEBUG_MCP_DISABLE_LANGUAGES`) stay listed with a disabled reason on both modes.
- `modes.attach.by` lists the `attach_to_process` addressing forms the language accepts — `"processId"`, `"port"`, `"adapterConfig"` (a debugger URI under `adapterConfig`) — as its adapter declares them (the attach-addressing contract, issue #903); present on every attach-capable language, installed or not. A request using any other form is refused by name before the session changes state.
- `languages[]` is the backward-compatible metadata shape: `id`, `displayName`, `version`, `requiresExecutable`, and `defaultExecutable` for the languages that have one (`mock` does not).

---

### attach_to_process

Attaches the debugger to a running process. The target is verified after the handshake by polling for threads, whatever `stopOnEntry` says; if none are reported within `verifyTimeout` the attach fails and the proxy is torn down. With `stopOnEntry: false` the post-attach pause is skipped and the session is reported as `running`.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.
- `port` (number, optional): Debug port to attach to. Refused by name on a PID-only language (C/C++, COBOL, .NET) — see [Addressing by language](#addressing-by-language).
- `host` (string, optional): Host to attach to; the adapter defaults it (`127.0.0.1` for every adapter but Java, which uses `localhost`). A non-loopback host on a PID-only language is refused the same way.
- `processId` (number or string, optional): The PID of a process on this host, for the languages whose attach is local — see [Addressing by language](#addressing-by-language). For JavaScript (issue #871) the inspector of the running Node.js process is activated for you (`SIGUSR1` / `process._debugProcess`), confirmed to belong to that PID, and attached on `port` — `9229`, Node's default, unless the target was started with `--inspect-port=<n>` (then pass that port; without it the attach fails, saying the signal was sent and that an inspector may now be open on another port, #1310); a PID that is not a Node.js process, or a port held by another inspector, is refused by name. This server does not close the inspector: it is left listening, unauthenticated, when the session ends (#1261), and the attach, detach and close answers say what the attach observed in `inspector` (see the JavaScript guide for the texts). See the [JavaScript guide](javascript/README.md#attaching-to-a-running-nodejs-process).
- `timeout` (number, optional): Connection timeout in milliseconds, forwarded as-is: js-debug honours it (its own default is 10 s) and COBOL uses it as its manifest-build budget; the other adapters ignore it. A value longer than `verifyTimeout` means the verify deadline is what you hit.
- `verifyTimeout` (number, optional): How long to wait (ms) for the debugger to report at least one thread after attaching before failing the attach (default: `20000`, max: `600000`). Decrease for fast failure-by-design probes; increase for targets that are exceptionally slow to become debuggable.
- `sourcePaths` (string[], optional): Directories that hold the program's sources. Java: the source roots a stop's file is looked up under, so a pause or a step into a class that has no breakpoint answers a path with `context` instead of the JVM's relative `com/acme/App.java` (issue #1138; an attach knows no other root until a line breakpoint's path shows one — see the [Java guide](java/README.md#where-a-stops-source-file-is-found)). .NET: the directories scanned for PDB files.
- `stopOnEntry` (boolean, optional): Request a pause immediately after attaching. Anything but `false` — including omitting it — pauses the target once the thread verification above succeeds; `false` skips the post-attach pause (never the verification), and the attach returns `state: "running"`. **Pass `false` when attaching to a live service you still need to use** — this is the opposite of `start_debugging`, whose `stopOnEntry` defaults to `false`. A pause that lands after the response is reported as `pending: true` and named in `message`.
- `justMyCode` (boolean, optional): Only debug user code (skip library code).
- `breakOnExceptions` (string, optional): `"uncaught"`, `"all"`, or `"none"` — same mode semantics as on `start_debugging`, but attach never applies a language default: it stays `"none"` unless requested.
- `adapterConfig` (object, optional): Adapter-specific attach extras, merged into the attach config before the adapter transforms it, mirroring `start_debugging`'s `adapterLaunchConfig` (C/C++/LLDB example: `{"program": "/proc/1/root/pricer"}` for symbol resolution from a kubectl-debug ephemeral container, or `initCommands`; Python example: `{"pathMappings": [{"localRoot": "/home/user/checkout/src", "remoteRoot": "/app"}]}` so breakpoints at local-checkout paths bind against a remote debugpy, issue #450). Reserved keys `request`/`__attachMode` are ignored with a warning; set `stopOnEntry` via the top-level parameter. A Python attach also sends debugpy `clientOS`, the operating system of the machine mcp-debugger runs on (`"WINDOWS"` on Windows, `"UNIX"` elsewhere), and adds it only when `adapterConfig` passes none of `clientOS`, `debugOptions` and `options` (issue #1304): debugpy matches your paths against `localRoot` and writes the paths it translates back by that system's separator, and without the key keeps its current setting (the target's own system unless an earlier attach to that process set another), so a Windows host's `C:\…\app\service.py` under a `localRoot` without a trailing separator became `/srv/app\service.py` on a Linux target, a file that does not exist there. A Linux or macOS host attaching to a Windows target sends `"UNIX"`: the client's paths are matched case-sensitively, and the paths translated through `pathMappings` come back with `/` (without mappings debugpy returns the target's native paths). Set `clientOS` yourself when the paths you pass are written in the other system's style than the server's machine, such as `C:\…` paths sent to the Docker image, and whenever you pass `debugOptions` or `options`, since no default is added then (from a Windows host to a Linux target, `{"options": "REDIRECT_OUTPUT=True", "pathMappings": [...]}` needs `"clientOS": "WINDOWS"` beside it). It is forwarded as given: debugpy accepts `"windows"`, `"unix"` and `"win"` in any case, an empty string leaves pydevd's current client-system setting unchanged (the target's own system unless an earlier attach to that process set another), and any other value fails the attach in the target.

**Addressing by language:**

Which forms a language accepts is declared by its adapter (the attach-addressing contract, issue #903) and checked before anything starts: a form the language does not take is refused by name — with the adapter's remedy and the forms it does take — and the session stays usable. A request that names neither `processId` nor `port` on a language whose forms are only those two is refused as "needs port" / "needs processId"; a language that also takes a URI under `adapterConfig` leaves that case to its adapter. `list_supported_languages` shows each language's forms as `modes.attach.by`.

| Language | Attaches by | A `processId` | A `port` (or a remote `host`) |
|---|---|---|---|
| C/C++, COBOL, .NET | `processId` only | used | refused: CodeLLDB and netcoredbg attach to a local PID (a gdbserver-style remote target goes through C/C++ `adapterConfig.processCreateCommands`) |
| JavaScript | `processId`, `port`, or `adapterConfig.websocketAddress` (the inspector URL from `/json/list`; js-debug dials it directly, no `port` needed — issue #896) | the running Node.js process's inspector is activated and attached on `port` (issue #871) | used |
| Python, Ruby, Java | `port` only | refused, with the recipe for opening a port (`python -m debugpy --listen …`, `rdbg --open --port …`, `-agentlib:jdwp=…`) | used |
| Dart | `port`, `adapterConfig.vmServiceUri` / `vmServiceInfoFile`, or `adapterConfig.deviceId` alone for a Flutter app on an Android device or emulator (`flutter attach` discovers it, issue #882) | refused, with the VM-service recipe | used — `host`/`port` becomes `ws://host:port/ws`, which needs `--disable-service-auth-codes` (the response `warning` says so) |
| Go, Rust, Mock | no attach | refused (`Attach mode is not implemented`) | refused |

The same pass records where the target lives (`processId` → this host; `port` → loopback or remote by its `host`; a URI → by its hostname), which is what lets `set_breakpoint` content-address a local attach (see [set_breakpoint](#set_breakpoint)).

**Response:**
```json
{
  "success": true,
  "state": "paused",
  "message": "Attached to process at 127.0.0.1:5678",
  "location": { "file": "/abs/path/app.py", "line": 42, "column": 1 },
  "context": { "lineContent": "    total += price", "surrounding": ["…"] },
  "snapshot": { "frames": [ { "name": "loop", "file": "/abs/path/app.py", "line": 42 } ], "locals": { "total": "75.0" } },
  "data": {
    "message": "Attached to process at 127.0.0.1:5678",
    "location": { "file": "/abs/path/app.py", "line": 42, "column": 1 }
  }
}
```

A paused attach answer carries the same landing every stop answer carries (issue #982): `location`, `threadId`/`note` when there is something to say, the source line as `context`, the stale-build sentence, and the [stop snapshot](#the-stop-snapshot) — the same shape as `pause_execution`, and `create_debug_session`'s attach shortcut answers identically.

When the requested pause has not landed by the time the tool answers (a Ruby program blocked in a system call, say; an idle Node server's pause does land, see the notes), the response says so:
```json
{
  "success": true,
  "state": "running",
  "pending": true,
  "message": "Attached to process at 127.0.0.1:9229; post-attach pause pending — the target stops when it next executes code; call wait_for_stop to block until it does (pass stopOnEntry: false to attach without pausing)",
  "data": {
    "message": "Attached to process at 127.0.0.1:9229; post-attach pause pending — the target stops when it next executes code; call wait_for_stop to block until it does (pass stopOnEntry: false to attach without pausing)",
    "pending": true
  }
}
```

**Notes:**
- `state` is `"paused"` only once a stopped event has actually been observed; otherwise the attach reports `"running"`. When a requested post-attach pause is accepted but its stopped event has not arrived within the bounded wait, the response is successful with `state: "running"` and `pending: true` (at the top level and in `data`) and the `message` names the pending pause; the late stopped event is the only transition to `paused` — [`wait_for_stop`](#wait_for_stop) blocks until it arrives — and every paused session has a `lastStop`.
- An idle Node server answers `paused` (issue #1146): before it requests the pause the server schedules one no-op timer in the target, and the pause lands when it fires, in Node's timer loop. With no pausing breakpoint set, the attach answer then carries (at the top level and under `data`) `note: "No program frame is active on thread 0: the only frame is internal/runtime (top: 'process.processTimers' <node_internals>/internal/timers:527). The stop landed outside your code: continue_execution and trigger activity, or set a breakpoint."`, `get_stack_trace` shows that one frame with `noProgramFrame: true` and the same note, and `get_local_variables` returns that frame's own variables with the same flag and a note saying whose they are (issues #900, #1135). Under load the pause can instead land inside js-debug's own start-up evaluation in the target, and the frame is then a sourceless `<anonymous>` (`<unknown_source>:1`) with the same note (issue #900). Breakpoints set before the attach are re-sent before the pause is requested, so they are bound when it answers. It used to answer `pending: true`, and with a breakpoint set the pause then fired inside js-debug's own code in the target and could leave the server frozen. A program the timer cannot wake (busy in native code, or `setTimeout` replaced) still answers `pending: true`; while that pause is pending, breakpoint requests are held and sent when the program stops (see [`set_breakpoint`](#set_breakpoint)). If the target session does not answer the breakpoint re-send within 3 s (a large source-mapped project can take longer), the pause is not requested at all and `warning` says so: the program is running. The server cannot see when js-debug finishes that work; a breakpoint turning `verified` in `list_breakpoints` is the sign that it has. `pause_execution` pauses the program (asked for while the re-send was still outstanding, it landed in the timer loop in every measured run). Either way, attach to a live server you still need to use with `stopOnEntry: false`.
- A `paused` attach answer reads where its stop landed through the same resolver read as `get_stack_trace` (issue #904): one `stackTrace` round trip, and on a thread whose stack has not materialised yet (a .NET post-attach pause) the bounded readiness wait `get_stack_trace` used to pay, now on the attach's own clock. On Windows, where CodeLLDB reported the attach stop on the injected break-in thread and the attach anchored on the program's thread instead, the answer's `note` says `The stop was reported on thread X; inspection is anchored on thread Y.`
- The initial stop of an attach is reported as `lastStop.reason: "pause"` (`stopReason: "pause"` in `get_stack_trace`) by every adapter, whether the debugger paused the target on request or, as CodeLLDB does, stopped it itself. On Windows, CodeLLDB reports that stop as the `DebugBreakProcess` break-in — an `0x80000003` exception on a helper thread — so the adapter's own words stay beside the pause as `lastStop.rawReason: "exception"` and `description: "Exception 0x80000003 encountered at address …"` (issue #817). Only the first stop of an attach that did not pass `stopOnEntry: false` is read this way: a break-in met later, or first by an attach that opted out of the initial stop, is a real `__debugbreak()` and keeps `reason: "exception"`.
- When `processId` was used, the message reads `Attached to process PID <pid>` instead.
- A JavaScript attach by `processId` says what it observed of an inspector in `inspector` (issue #1261), on success and failure, never what opened it, whose it is, or how long it will listen: `signalled: 127.0.0.1:9229 refused this attach's first probe, this attach then signalled PID <pid>, and an inspector answered there after the signal, unauthenticated; this server does not close it`; `already open: an inspector answered this attach's first probe on 127.0.0.1:9229, so no signal was sent; this server does not close it`; or, after a failure that followed the signal, `signalled: this attach signalled PID <pid>, and no inspector of it was identified on 127.0.0.1:9229; one may now be open on another port, and this server does not close it`. An attach by port or by inspector URL carries no `inspector`. Its session's [`detach_from_process`](#detach_from_process) and [`close_debug_session`](#close_debug_session) carry it too.
- The response `warning` reports two distinct `adapterConfig` key outcomes (issues #450/#466): keys the adapter's attach transform genuinely drops (e.g. Python's ptvsd-era `localRoot`/`remoteRoot` — use `pathMappings`) are named as **ignored**, while keys mcp-debugger doesn't recognize are **forwarded to the adapter as-is** and named with an edit-distance suggestion for near-misses (`pathMapping (did you mean pathMappings?)`) — "ignored" means dropped, "forwarded as-is" means the adapter still sees them. The same field also carries the launch-style warning for function breakpoints still unverified at attach (issue #308), and the adapter's own attach-transform notes (issue #908): Dart's note that a `host`/`port` attach built a no-auth `ws://…/ws` URI (and that a `deviceId` is ignored on a Dart runner), COBOL's build options given without `sources` and its C-view-only note.
- js-debug attach honors `adapterConfig` too: `localRoot`/`remoteRoot`/`sourceMaps`/`skipFiles`/`continueOnAttach` and other js-debug attach options reach the debugger (issue #466). Two keys are defaulted when absent (issue #655): `resolveSourceMapLocations: ["**", "!**/node_modules/**"]` (js-debug's own attach default collapses to "resolve everywhere", which applied every dependency's `.js.map` and produced phantom `../src/*.ts` frames) and `cwd` (the server's working directory, or the workspace root in container mode — js-debug needs a base path before it resolves any source map's relative `sources`, even ones next to the generated file). Pass your own value, including `resolveSourceMapLocations: null`, to override. `skipFiles` is deliberately left at js-debug's default: an attach leaves it unset so the target's own files and dependencies are not silently skipped unless requested — `get_stack_trace` hides internal frames instead.
- js-debug child auto-attach defaults off on every attach form, including `processId`, preserving 0.26.0's off default: no bootloader is injected into the target for future children. To make processes the target starts afterwards debuggable, pass `adapterConfig: { autoAttachChildProcesses: true }` on the attach; this makes later children load a file from this server through `NODE_OPTIONS` and wait at startup for the debugger; they can fail if the file is unavailable, start late if forks outpace attaches, or remain waiting if forked during detach (#1286); the target and its children must be able to load the server's js-debug bootloader and reach its debugger endpoint. Explicit booleans are preserved; see the [JavaScript guide](./javascript/README.md) for the opt-in's effects on later children and detach (#1286).
- `justMyCode` has no effect on a JavaScript attach: js-debug has no such key, and the attach transform derives nothing from it (a launch derives `skipFiles` and `smartStep` from it — see [start_debugging](#start_debugging)). Set `adapterConfig.skipFiles` / `adapterConfig.smartStep` yourself; attach defaults `smartStep` to `false` and leaves `skipFiles` unset (issue #513), so pauses and steps land where the program is (issue #678). `smartStep: true` there turns on the server's stepping through skipped code, as on a launch (issue #1130); js-debug's own stepper stays off either way.
- Breakpoints set before the attach are re-sent once the debuggee-owning session is provably live, so their verified state in `list_breakpoints` is authoritative.
- Languages whose adapter has no attach implementation (`rust`, `go`, `mock`) fail fast with a clear error.
- A failed attach reports `success: false` with the reason in `message` (`Failed to attach: ...`) and tears the proxy down, so no live proxy is left behind; `state` is then `"error"` (or `"stopped"` if the session was already gone). When the adapter answers the handshake's attach request with its own error response, the attach fails at once in its words (issue #896): `Failed to attach: The javascript debug adapter rejected the attach request: …`. When the adapter itself ended the session while the attach was being verified — it exited, or dropped its DAP connection as js-debug does after failing to reach the inspector — the message says which and quotes the adapter's last stderr line (issue #897): `Failed to attach: The debug adapter ended the session during attach verification: it closed its DAP connection; its last stderr line: "Error: Could not connect to debug target at http://localhost:5678: Could not find any debuggable target"`. When the failure happened during proxy initialization, `data` carries `proxyLogPath`, `proxyLogResource`, and `initProgress` diagnostics. Session-lifecycle failures (unknown or terminated session) return the standard application-level `error` payload instead — see [Error Handling](#error-handling).

---

### detach_from_process

Detaches the debugger from a process the session attached to, leaving the process running.

**A session owns a program it launched and borrows one it attached to** (issue #1151). Ending a session ends what it owns, in every adapter, so there is no detach that leaves a launched program running: a plain `detach_from_process` on a launched session is refused before anything is touched, with `success: false`, the session's `state` unchanged, and a `message` that says so and names what to do (`close_debug_session`, or `terminateProcess: true`, to end the program; to debug a program that must keep running afterwards, start it outside the debugger and use `attach_to_process`). It used to answer `Detached from process (process still running)` while the program was gone. Owned or borrowed is what the debug adapter was actually started to do, read from the launch config after the adapter's own transform: a `start_debugging` whose arguments are attach-shaped is a launch all the same on an adapter that has no attach (Rust, Go), and is refused like one. A launch option that starts a program so it can outlive its session is tracked in #1156.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.
- `terminateProcess` (boolean, optional): Terminate the process on detach (default: `false`).

**Response:**
```json
{
  "success": true,
  "state": "stopped",
  "message": "Detached from process: the debug adapter confirmed the detach, and the process was left running",
  "released": true,
  "data": {
    "message": "Detached from process: the debug adapter confirmed the detach, and the process was left running",
    "released": true
  }
}
```

**What became of the process is observed, not assumed** (issue #1148). The answer is read from what the debug adapter did with the detaching `disconnect`:

- `released: true`: the adapter acknowledged the detach, by answering the request or by sending `terminated` in reply to it (debugpy does the latter). The process was left running.
- `processEnded: true`: the adapter reported that the program exited (`message`: `Detached from process: the debug adapter reported that the program had exited, so there is no process left running`).
- Neither field, and a `warning` that carries the `message` (joined with the pre-detach resume's note when that resume was refused too): `Detached, but the debug adapter did not confirm it (<why>). The debugger was stopped anyway; whether the process is still running is not known`. The adapter did not acknowledge the detach within 10 s; it is stopped all the same, and what that did to the target is not something the server saw. `success` is still `true`: the session is ended either way. This used to answer `Detached from process (process still running)`, after 30 s.

The 10 s is sized by measurement: every attach-capable adapter acknowledges a detach in 0 to 15 ms, and the worker may first spend up to 2 s resuming a stopped CodeLLDB target.

**Notes:**

After a local JavaScript attach (PID or loopback) with child debugging enabled,
`detach_from_process` adds this `note` unless termination was requested or an exit
was observed (#1288):

> Child debugging changed the target for the rest of its life: processes it starts later still load a file from this server's install through NODE_OPTIONS after detach; see the attach_to_process description.

- With `terminateProcess: true` the whole session is closed and the message reads `Detached and terminated process`.
- After a JavaScript attach by `processId` that signalled, the detach and the close say what one probe of the inspector's address (1 s at most) sees, in `inspector` (issue #1261): `listening: an inspector answers on 127.0.0.1:9229, unauthenticated (one answered there after this attach signalled PID <pid>); this server does not close it`, `not listening: 127.0.0.1:9229 no longer accepts connections (…)`, or `not checked: 127.0.0.1:9229 did not answer as an inspector (<what was seen>); …`. After one that found an inspector open they do not probe: `left as it was: an inspector answered this attach's first probe on 127.0.0.1:9229, so no signal was sent; this server does not close it`. This server closes no inspector.
- Detaching sends DAP `disconnect` with `terminateDebuggee: false`, then stops the proxy; the session ends in `"stopped"` either way, so a later re-attach needs a new session.
- CodeLLDB sessions on Windows (C/C++ and COBOL attach sessions): while the target is stopped, a DAP `continue` goes out ahead of the detaching `disconnect` — on this path, on `close_debug_session` and on shutdown alike — and `data.resumedBeforeDetach` is `true`; if the debugger refuses the continue, the detach still proceeds with `resumedBeforeDetach: false` and `data.warning` names the risk. Why: CodeLLDB's Windows detach otherwise kills a target whose last resume was a step (issue #763; the mechanism is in the C/C++ guide's attach section).
- Detaching a session with no active debug process reports `success: false` with `No active debug session to detach from` in `message`. That includes a session already detached: a second detach does not repeat the first one's answer.
- **An attach root with child sessions** (the session tree, issues #1081 and #1082; Python and JavaScript): the children are detached first, deepest first, each with `disconnect` and `terminateDebuggee: false` so it runs on undebugged, then the parent. The child rows stay listed as `stopped` with `programEnd: { note: "Released: detached with its parent; the process runs on undebugged.", data: { released: true } }`, and the answer carries `childrenReleased: n` — n children now run undebugged (top level and in `data`). With `terminateProcess: true` the whole subtree is closed and the answer carries `childrenClosed: n` instead.

---

### list_threads

Lists all threads in the debugged process. Thread ids from here are what `get_stack_trace`'s and `pause_execution`'s `threadId` parameters accept.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.

**Response:**
```json
{
  "success": true,
  "threads": [
    { "id": 1, "name": "MainThread" },
    { "id": 2, "name": "worker-0" }
  ]
}
```

**Notes:**
- Requires a live debug process: an unknown or terminated session, or one whose proxy is not running, returns an application-level failure (see [Error Handling](#error-handling)).
- A failed DAP `threads` response is propagated as an error rather than flattened into an empty-but-successful list (issue #124).

---

## IDE Mirror

The DAP mirror (issue #217) lets a human attach an IDE — VS Code, nvim-dap, any DAP client — to an agent-owned debug session as a **read-only second client**. The agent debugs a process no IDE launched (CI, a container, a terminal-driven run), parks it at an interesting point, and hands over host/port/token; the human lands on the live paused frame and inspects real state. Execution control stays with the MCP session.

### expose_session

Starts a per-session DAP server endpoint on `127.0.0.1` (ephemeral port) inside the session's debug proxy. Requires an active session (launched or attached); works while running or paused. Idempotent — calling it again returns the same endpoint and token.

**Parameters:**
- `sessionId` (string, required): The debug session ID

**Response:**
```json
{
  "success": true,
  "state": "paused",
  "host": "127.0.0.1",
  "port": 52341,
  "token": "kx3P…32-char-random…",
  "message": "Session exposed for IDE attach at 127.0.0.1:52341. VS Code: add a launch.json config … and start it. …"
}
```

The endpoint closes on `unexpose_session`, `close_debug_session`, `restart_debugging`, or debuggee exit. `list_debug_sessions` shows `exposure: {host, port}` for exposed sessions (never the token).

Note: the mirror serves a human's IDE and proxies DAP responses directly, so it shows **raw variable values** — [secret redaction](#secret-redaction) does not apply to this surface.

**Connecting VS Code:**

```jsonc
// .vscode/launch.json
{
  "name": "Mirror: agent debug session",
  "type": "debugpy",           // your language's debug type — see table below
  "request": "attach",
  "debugServer": 52341,         // the port from expose_session
  "mirrorToken": "<token from expose_session>"
}
```

`debugServer` points VS Code directly at a running DAP server; extra properties like `mirrorToken` are passed through in the attach request, where the mirror validates them.

| Session language | VS Code `type` |
|---|---|
| python | `debugpy` (`python` is the extension's deprecated alias) |
| javascript | `node` |
| java | `java` |
| go | `go` |
| rust | `lldb` |
| dotnet | `coreclr` |
| ruby | `rdbg` |

Other DAP clients (nvim-dap, etc.): connect a TCP DAP client to the host/port and include `mirrorToken` in the `attach` request arguments.

**Measured** (2026-11-02, VS Code 1.116.0 with ms-python.debugpy 2026.6.0, a Python launch paused at a breakpoint): F5 on the config above — `type: debugpy`, no `connect` block, nothing else — lands the IDE on the paused frame with the call stack, Locals and the Debug Console's `evaluate` served live from the adapter; the IDE follows every stop the MCP session drives (`step_over`, `continue_execution` to the next breakpoint); pressing Continue or Step in VS Code shows the mirror's refusal as a warning (`The mcp-debugger mirror is read-only; 'continue' is controlled by the primary session`) and the IDE stays attached; `unexpose_session` ends the IDE's debug session cleanly, with no error dialog.

**What the mirror serves:**
- Answered locally: `initialize` (from the adapter's real capabilities, with control affordances masked off), `attach`/`launch` (token check), `configurationDone` (also the trigger for the late-join stopped replay below), `disconnect` (that client only), `cancel`.
- Forwarded to the live adapter: `threads`, `stackTrace`, `scopes`, `variables`, `source`, `evaluate`, `exceptionInfo`, `loadedSources`, `modules`.
- Soft-succeeded so IDE attach flows survive: `setBreakpoints`/`setFunctionBreakpoints` (reported unverified — breakpoints stay agent-owned), `setExceptionBreakpoints`.
- Rejected with a quiet error: `continue`, `next`, `stepIn`, `stepOut`, `pause`, `setVariable`, `restart`, `terminate`, and every other control or mutation request.

On attach while the session is paused, the mirror replays the last stop as a `stopped` event, so the IDE lands directly on the paused frame. The replay is delivered when the client sends `configurationDone` (standard DAP handshake order); clients that skip `configurationDone` receive it after a short (~200ms) fallback. Live events, by contrast, are broadcast to every attached client immediately.

**Security:** the endpoint binds loopback only and every client must present the per-expose token. Treat the token as a **debuggee-execution capability**, not a view-only credential — `evaluate` is forwarded, and DAP evaluate can run arbitrary code in the debuggee. The token appears only in the `expose_session` result and is redacted from logs. "Read-only" means execution control and breakpoint changes are rejected, not that the debuggee is immutable.

**Container note:** when the server runs inside a container, the mirror listens on the *container's* loopback — a host IDE cannot reach it without extra networking (`docker run --network host` on Linux, or a socat/ssh forward into the container). The same applies to any deployment where the MCP server host is not the IDE host.

### unexpose_session

Closes the mirror endpoint and disconnects any attached IDE clients (they receive a `terminated` event). A no-op success when the session is not exposed.

**Parameters:**
- `sessionId` (string, required): The debug session ID

**Response:**
```json
{
  "success": true,
  "state": "paused",
  "wasExposed": true,
  "message": "Mirror endpoint closed (1 client disconnected)"
}
```

---

## Language-Specific Tools

### hot_reload

Apply changed code to the running program and keep its state — the adapter's own live update. Two adapters have one today; the tool is refused by name on the others.

- **Flutter** (a `flutter run` / `flutter attach` session): the SDK adapter's **hot reload**. The reassemble runs `build()`, so a breakpoint there is reported by this call as the stop, with its `location` and `snapshot` (measured: ~150 ms after the request on desktop; on web the adapter holds its response until the paused isolate resumes, which is why the call answers the stop rather than waiting for the response). Widget state, counters and timers survive. A reload sent to a *paused* program answers at once and lands when the program resumes (`note` says so). Before the app has reported `appStarted`, and on a plain Dart program, the call is refused by name.
- **Java**: class redefinition (JDI `VirtualMachine.redefineClasses()`, HotSwap) — the former `redefine_classes` tool, whose answer is unchanged.

`redefine_classes` is a **deprecated alias** of this tool: still accepted, answered with a `warning`, not advertised by `tools/list`, removed at 1.0.

**Parameters:**
- `sessionId` (string, required): The debug session ID.
- `classesDir` (string, Java only): Absolute path to the compiled classes directory (e.g., `build/classes/java/main/`). Required on Java; refused on Flutter.
- `sinceTimestamp` (number, Java only, optional): Unix timestamp in milliseconds. Only redefine `.class` files modified after this time. `0` or omitted = scan all files.
- `timeout` (number, optional): Maximum time in milliseconds to wait for the update to complete (default: 30000, max: 600000). Increase when hot-swapping many classes at once.

**Response (Flutter, the reassemble reached a breakpoint):**
```json
{
  "success": true,
  "state": "paused",
  "reason": "breakpoint",
  "location": { "file": "/app/lib/main.dart", "line": 30, "function": "_ProbeAppState.build" },
  "snapshot": { "frames": ["…"], "locals": ["…"] }
}
```
A reload whose program is still running when the hold elapses answers `state: "running"` with `pending: true` — call `wait_for_stop` for a stop it may land on.

**Response (Java):**
```json
{
  "success": true,
  "state": "paused",
  "redefined": ["com.example.Foo", "com.example.Bar"],
  "redefinedCount": 2,
  "skippedNotLoaded": 3,
  "failedCount": 1,
  "failed": [
    { "fqcn": "com.example.Baz", "error": "UnsupportedOperationException: class redefinition failed: attempted to add a method" }
  ],
  "scannedFiles": 6,
  "newestTimestamp": 1711500000000
}
```

**Example — Flutter:**
```json
{ "sessionId": "abc-123" }
```

**Example — Java, full scan:**
```json
{
  "sessionId": "abc-123",
  "classesDir": "/project/build/classes/java/main"
}
```

**Example — Java, incremental scan (pass `newestTimestamp` from the previous call):**
```json
{
  "sessionId": "abc-123",
  "classesDir": "/project/build/classes/java/main",
  "sinceTimestamp": 1711500000000
}
```

**Notes:**
- Statement-anchored breakpoints are re-resolved against the new source after the update (`anchorResolution` reports moved/stale, as `restart_debugging` does); moved ones are re-sent so they bind against the new line table.
- Java: classes must already be loaded in the target JVM — unloaded classes are skipped (`skippedNotLoaded`); schema changes (adding/removing methods or fields) fail for individual classes without blocking others; the `newestTimestamp` in the response enables incremental workflows.
- Java: the session can be paused or running when calling this tool. Flutter: the app must have started.
- Hot *restart* (re-run `main()` in the same process) is `restart_debugging` on a Flutter session.

---

## Error Handling

Tools can return errors in two formats:

1. **MCP transport errors**: Standard JSON-RPC error responses with numeric error codes. These indicate protocol-level failures.
2. **Application-level failures**: JSON payloads with `{ "success": false, "error": "..." }`. Most tool failures use this format, where the HTTP/transport layer succeeds but the operation itself failed.

### Common Error Codes (MCP transport errors)
- `-32603`: Internal error (feature not implemented, unexpected failures)
- `-32602`: Invalid parameters (e.g., missing `sessionId`)

Session-lifecycle failures (unknown/terminated session, proxy not running) are application-level failures: they return `{ "success": false, "error": "..." }` rather than an MCP transport error. Classification is based on typed lifecycle errors, never on words in an error message; an invalid path, expression, or breakpoint containing text such as `closed` or `not found` remains its original MCP error.

### MCP Error Response Format
```json
{
  "code": -32603,
  "name": "McpError",
  "message": "MCP error -32603: {specific error message}",
  "stack": "{stack trace}"
}
```

### Application-Level Error Format
```json
{
  "success": false,
  "error": "Session is not paused",
  "message": "Cannot get local variables. The session must be paused at a breakpoint."
}
```

### Common Error Scenarios
1. **Session not found**: Occurs when a session terminates unexpectedly or was closed. A session the idle policy closed (`MCP_DEBUG_SESSION_IDLE_MS`, see `create_debug_session`) says so instead: `{ "success": false, "error": "Session … was closed by the idle policy at … Its program was ended. Create a new session to continue.", "closedBy": "idle-policy" }`. The sentence about the program is one of four: "Its program was ended." (a launched program the policy ended), "The process it was attached to was released and keeps running." (the debug adapter acknowledged the detach), "The debug adapter did not confirm that it released the process it was attached to, so whether that process is still running is not known." (it did not; issue #1148), or "It had no running program by then." (the session never launched, or its program was already over). An id created by another MCP client of the same process is found like any other; one outside the caller's scope (a future authenticated `http` mode; today every caller shares one scope) does not exist for that caller — every tool answers it exactly as it answers an id nobody holds (issue #1025)
2. **Invalid language**: Language must be one of the supported languages (discovered dynamically from installed adapters)
3. **File not found**: When setting breakpoints in non-existent files
4. **Invalid scope**: When passing wrong variablesReference to get_variables

`start_debugging` reports `success: false` when the proxy or adapter enters an `error` state during readiness and includes available proxy-log diagnostics. A program that exits cleanly before the debugger pauses is still a successful result with `state: "stopped"`.

---

## Best Practices

1. **Always check session state** before performing operations
2. **Use absolute paths** for files to avoid ambiguity
3. **Get scopes before variables** - you need the variablesReference
4. **Handle session termination** gracefully - sessions can end unexpectedly
5. **Set breakpoints on executable lines** - avoid comments and declarations
