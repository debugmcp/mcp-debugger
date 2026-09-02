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
   - [start_debugging](#start_debugging)
   - [restart_debugging](#restart_debugging)
   - [step_over](#step_over)
   - [step_into](#step_into)
   - [step_out](#step_out)
   - [continue_execution](#continue_execution)
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
   - [redefine_classes](#redefine_classes)

---

## Session Management

### create_debug_session

Creates a new debugging session.

**Parameters:**
- `language` (string, required): The programming language to debug. Languages are discovered dynamically from installed adapters. The default fallback languages (when dynamic discovery is unavailable) are `"python"` and `"mock"`. When all adapters are available, the full list is: `"python"`, `"ruby"`, `"javascript"`, `"rust"`, `"go"`, `"java"`, `"dotnet"`, `"cpp"`, `"mock"`. The actual list depends on which `@debugmcp/adapter-*` packages are discoverable at runtime. A language may be usable in one mode only — e.g. in the Docker container Ruby is attach-only (the adapter ships without a Ruby runtime; attach connects directly to a remote rdbg socket). Check `list_supported_languages` `modes` for per-mode availability; creating a session for an attach-only language is allowed, and only `start_debugging` will fail.
- `name` (string, optional): A descriptive name for the debug session. Defaults to `"<language>-debug-<timestamp>"` (e.g., `"python-debug-1711500000000"`), built from the session language and `Date.now()`.
- `executablePath` (string, optional): Path to the language interpreter/executable (e.g., Python interpreter path).
- `host` (string, optional): Host to attach to for remote debugging. Defaults to `localhost`.
- `port` (number, optional): Debug port to attach to. **Passing `port` switches the call into attach mode** — the session is created and immediately attached (see [attach_to_process](#attach_to_process) for the full attach contract). `host` alone does not trigger it.
- `stopOnEntry` (boolean, optional): Attach mode only — same semantics as [attach_to_process](#attach_to_process)'s `stopOnEntry`: **omitting it pauses the target after attach** (the pause may land after the response, reported as `pending: true` and named in `message`); pass `false` to attach to a live service without stopping it.
- `timeout` (number, optional): Attach mode only — connection timeout in milliseconds (default: `30000`).
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
- When a `port` parameter is provided in `create_debug_session`, the server performs an inline attach (creating the session and immediately attaching to a running process on that port). The response then mirrors `attach_to_process`: alongside `sessionId` it carries `state`, the attach `data` payload, an optional `warning`, and — when a requested post-attach pause has not landed yet — `pending: true`, with `message` saying so (`…; post-attach pause pending — the target stops when it next executes code (pass stopOnEntry: false to attach without pausing)`)

---

### list_debug_sessions

Lists all active debugging sessions.

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
      "updatedAt": "2025-06-11T04:53:14.762Z"
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

Errored sessions include optional `diagnostics` with the current launch attempt's server-host `proxyLogPath` and remote-safe `proxyLogResource`. The record is retained for proxy initialization failures and for proxy/adapter deaths after initialization, and is cleared when a new launch or attach attempt begins.

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

**Notes:**
- Sessions may close automatically on errors
- Closing a non-existent session returns `success: false`

---

## Breakpoint Management

### set_breakpoint

Sets a breakpoint in a source file.

**Parameters:**

In the shipped default addressing mode (`content`), `sessionId` is the only parameter the schema marks required: address the breakpoint by `file` + `line`, by `file` + `statement`, or by `function` alone. Restricting the mode with `DEBUG_MCP_BP_ADDRESSING=line` (or `=assert`) removes `statement`, `nearLine` and `function` from the schema, and `file` + `line` become required.

- `sessionId` (string, required): The ID of the debug session.
- `file` (string): Path to the source file — **absolute** in host mode (a relative path is rejected with `Path must be absolute. Received: "..."`); in container mode paths are resolved against the `/workspace` mount, so a path relative to the mounted directory works there. For Java, a fully-qualified class name (e.g. `com.example.MyClass` or `com.example.Outer$Inner`) is preferred — it works reliably with every classloader.
- `line` (number): Line number where to set breakpoint (1-indexed).
- `statement` (string, optional): **Content addressing** — instead of `line`, pass the text of the target line, like an Edit-tool match — a distinctive substring is enough (leading/trailing whitespace and trailing `//`/`#` comments are ignored; an exact whole-line match always wins over substring matches). Can only land on a line containing your stated text — an inexact or multi-candidate match still sets the breakpoint but adds a `warning` to the response; if the text appears on multiple lines the error lists every match; anchors re-resolve across `restart_debugging` after file edits. Provide `statement` OR `line`, not both. See [Statement anchors](#statement-anchors).
- `function` (string, optional): **Symbol addressing** — break on entry to a function/method by name (DAP function breakpoint). Session-global: no `file` or `line` at all, and names survive edits better than both. Composes with `condition` only. Supported by Python, Go, Rust, C/C++, .NET, Java, and JavaScript (JavaScript names are dotted runtime paths delivered over the CDP bridge — see [Function breakpoints](#function-breakpoints)); Ruby is rejected up front (rdbg advertises the capability but its handler ignores the request, so nothing would ever bind).
- `nearLine` (number, optional): With `statement` only — when the statement text appears on multiple lines, bind to the match closest to this line (ties go to the lower line).
- `expectedContent` (string, optional): With `line` only — assert the text of the target line before setting; a distinctive substring is enough (leading/trailing whitespace and trailing `//`/`#` comments are ignored). On a mismatch the breakpoint is **not** set and the error shows the actual content of that line and its neighbors — a fast, self-explanatory failure instead of a breakpoint that silently lands on the wrong line. A relaxed match (substring, or one that only holds after ignoring text past a `//`/`#` marker) still sets the breakpoint but adds a `warning` quoting the actual line. See [Content assertions and loud snapping](#content-assertions-and-loud-snapping).
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
- The response echoes the resolved path the server actually used — in container mode that is the path with the workspace prefix applied; for attach sessions the path is passed through unchanged
- Setting breakpoints on non-executable lines (comments, blank lines, declarations) may cause unexpected behavior
- Executable lines that work well: assignments, function calls, conditionals, returns
- The top-level `content` field echoes the bound line's text (same as `context.lineContent`)

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
The file may have changed since you last read it. Pick the correct line from the context above.
```

Relatedly, when a debug adapter *accepts* a breakpoint but binds it to a different line (adapters snap requests on non-executable lines to the nearest valid one), the response reports it prominently instead of silently mutating the line: `message` and `warning` carry `"requested line 12, bound to line 13: \`...\`"`, and the response includes `requestedLine` alongside the bound `line`. Adapters that relocate breakpoints asynchronously (after the response) surface the move in `list_breakpoints`, where `line` ≠ `requestedLine` marks a snapped breakpoint.

`expectedContent` requires a source file the server can read: it is rejected for Java FQCN breakpoints and attach-mode sessions (remote filesystems). Both addressing aids can be restricted with the `DEBUG_MCP_BP_ADDRESSING` environment variable (`line` = pre-existing behavior, `assert` = + expectedContent/loud snapping, `content` = all features; default `content`) — useful for controlled comparisons of agent behavior.

#### Statement anchors

`statement` addresses a breakpoint by content instead of line number — the single most practiced agent skill (Edit-tool `old_string` matching) instead of line arithmetic:

```json
{ "sessionId": "...", "file": "/abs/app.py", "statement": "total = sum(prices)" }
```

- **Matching**: whole-line equality after trimming leading/trailing whitespace; when no exact match exists anywhere, a substring match against comment-stripped lines is accepted (exact matches always win — the two populations never mix). Multi-line input is rejected — anchor on the first line of a multi-line construct.
- **Ambiguity is an error, and the error is the disambiguation UI**: every matching `line: content` pair is listed (capped at 20); add `nearLine` to bind to the closest match. A `nearLine` pick among multiple matches adds a `warning` naming every candidate line — proximity is a heuristic, not a guarantee.
- **Blank/comment anchors are rejected** (`#`, `//`, `/*` prefixes) — debuggers cannot break there reliably.
- **The anchor is stored on the breakpoint record** (visible in `list_breakpoints`) and **re-resolves on `restart_debugging`**: after you edit the file — the whole point of a debug session — the relaunch re-finds each anchored statement in the current file (the breakpoint's previous line breaks ties between duplicates). Moves are reported in the restart response's `data.anchorResolution.moved` — a move picked among multiple matching lines carries a `candidates` list and a restart `warning`; anchors that no longer match keep their previous line and warn (`data.anchorResolution.stale`) rather than failing the restart or dropping state.
- Same readable-file requirement as `expectedContent` (no Java FQCNs, no attach sessions); composes with `condition`, `logMessage`, and `suspendPolicy` unchanged.
- A matching `expectedContent` alongside `statement` is accepted as redundant (matching under the same relaxed rules: trailing comments ignored, either value may be a substring of the other); a genuinely *different* one is an error (contradictory intent).

#### Function breakpoints

`set_breakpoint {sessionId, function: "process_order", condition?}` breaks on entry to a symbol, with no file or line:

- Session-global, name-addressed — the adapter resolves the symbol across the whole program, and the name survives any file edit. `restart_debugging` re-applies them natively.
- Composes with `condition` only (`logMessage` and `suspendPolicy` have no DAP function-breakpoint form; file/line/statement/expectedContent are contradictory and rejected).
- The response and `list_breakpoints` report the adapter's bound location as `boundFile`/`boundLine` once verified. `list_breakpoints` returns function breakpoints in a separate `functionBreakpoints` array (excluded when filtering by file); `remove_breakpoint` accepts `function: "name"` or the breakpoint id; an unscoped `clear_breakpoints` removes them, a file-scoped clear does not.
- Support is adapter-gated: Python, Go, Rust, C/C++, .NET, Java, and JavaScript work; Ruby is rejected up front — rdbg's initialize response advertises `supportsFunctionBreakpoints`, but the debug gem's DAP handler acknowledges the request and ignores it (verified against debug 1.11.0), so the Ruby policy pins the capability off rather than trust the advertisement.
- **A name that never binds is reported, not silent**: known-hazard names warn at set time (Go's bare identifiers need package qualification — `main.main`; a bare `main` on Rust resolves to the C runtime's entry point, use `my_crate::main`); function breakpoints still unbound after launch produce a `warning` in the `start_debugging` response (suppressed for JavaScript/Java, which bind late by design); and breakpoints that never bound by program exit get an explanatory `message` in `list_breakpoints` plus a `[mcp-debugger] Warning:` entry in `get_output`.
- Java names may be bare (`helper`), class-qualified (`Foo.helper`, `com.example.Foo.helper`, `Outer.Inner.helper`), or constructors (`Foo.<init>`). Every concrete overload binds (the reported `boundLine` is the first); classes not yet loaded bind on load and report through breakpoint events. Bare names skip JDK-internal classes (`java.*`, `javax.*`, `sun.*`, `jdk.*`, `com.sun.*`) — qualify the class to target those.
- **JavaScript semantics differ by design** (js-debug implements no DAP function breakpoints upstream — vscode-js-debug#952 — so ours are delivered over js-debug's CDP proxy via V8's `Debugger.setBreakpointOnFunctionCall`, the same primitive behind Chrome DevTools' `debug(fn)`). The name is a **dotted runtime path** (`handler`, `obj.method`, `globalThis.tick`), resolved side-effect-free against the top paused frame's scope (or global scope while running) and **bound to the function value it resolves to at that moment** — it is *not* a source-symbol search ("all functions named X" is not the contract), and reassigning the property later does not move the breakpoint. Top-level `function` declarations of the main module bind at launch; `const fn = ...` and functions in lazily-loaded modules stay `verified: false` with an explanatory message and bind automatically at the next pause. Names resolve against runtime names, not TypeScript/minified source names. Launch and attach modes both work (attach has no entry pause, so module-scoped names bind at the first pause after attach).

#### Logpoints

Passing `logMessage` turns the breakpoint into a DAP logpoint: when the line is hit the program does **not** pause — the message is logged and execution continues at full speed. Expressions in `{curly braces}` are interpolated with live values (e.g. `"order={orderId} total={total}"`), and the messages arrive in the session output, readable via [`get_output`](#get_output) and the `debug://sessions/{id}/output` resource. `condition` may be combined with `logMessage` — the message is only logged when the condition holds.

This is the prod-safe just-in-time diagnostics primitive: attach to a live process, plant logpoints at suspect lines, read interpolated values from `get_output` — no pauses, no pre-instrumented logging.

Support is adapter-dependent:

| Adapters | Behavior |
|---|---|
| Python, JavaScript/TypeScript, Go, Rust, C/C++, mock | Supported — logs without pausing |
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
    }
  ],
  "count": 1,
  "functionBreakpoints": [],
  "functionCount": 0
}
```

**Notes:**
- The array is sorted by file, then line. Conditional breakpoints include their `condition`; Java suspend policies appear as `suspendPolicy`.
- `functionBreakpoints`/`functionCount` are always present in the unfiltered response (empty arrays when none exist). When filtering by `file` they are omitted — function breakpoints are session-global, not file-scoped.
- `adapterId` is the debug adapter's own numeric id for the breakpoint, captured from setBreakpoints responses and breakpoint events. It is absent until the adapter has seen the breakpoint.
- Verification is eventually consistent: some adapters (js-debug, JDI, netcoredbg) bind breakpoints asynchronously and confirm via DAP breakpoint events shortly after launch or class load.

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

### start_debugging

Starts debugging a script.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.
- `scriptPath` (string, required): Path to the script to debug. Must be **absolute** in host mode (a relative path is rejected with `Path must be absolute`); in container mode it is re-rooted under `MCP_WORKSPACE_ROOT`.
- `args` (array of strings, optional): Command line arguments for the script.
- `dapLaunchArgs` (object, optional): Standard DAP launch arguments:
  - `stopOnEntry` (boolean): Stop at first line (default `false` — the opposite of attach, which pauses unless `stopOnEntry` is `false`)
  - `justMyCode` (boolean): Debug only user code
  - Additional DAP launch keys (`program`, `cwd`, `env`, language-specific options) pass through to the adapter. Top-level parameters do **not** belong here: a nested `breakOnExceptions` is honored as an alias (the top-level value wins if both are given) and reported via a `warning` in the response; other misplaced top-level keys (`dryRunSpawn`, `sessionId`, `scriptPath`, `adapterLaunchConfig`) are stripped with a warning instead of silently riding into the launch config.
- `adapterLaunchConfig` (object, optional): Adapter-specific launch configuration overrides. Use this for language-specific settings that go beyond standard DAP arguments (e.g., `mainClass` and `classpath` for Java, `buildCommand` for Rust). For Rust, `_adapterSettings` passes through to CodeLLDB (issue #441) — e.g. `{"_adapterSettings": {"scriptConfig": {"lang": {"rust": {"sysroot": "/path"}}}}}` points the Rust formatter lookup at an explicit sysroot; the `CODELLDB_RUST_SYSROOT` env var does the same without per-launch config (a user-supplied `_adapterSettings` value wins over the env var).
- `dryRunSpawn` (boolean, optional): Test spawn without actually starting
- `breakOnExceptions` (string, optional): `"uncaught"` pauses at uncaught exceptions at the crash site (stack and locals inspectable) instead of terminating the session; `"all"` also pauses on caught/raised exceptions (language-dependent). **Launch sessions default to `"uncaught"`** (issue #244) — a crashing script pauses with `lastStop.reason: "exception"` instead of terminating; pass `"none"` to opt out and let it run to termination. Ruby is the exception: rdbg has no uncaught-only filter, so Ruby launches stay `"none"` by default (only explicit `"all"` is available). Attach sessions never apply a language default. The abstract mode maps to per-language debugger filters (e.g. Python `uncaught`/`raised`, JavaScript `uncaught`/`all`, Java `uncaught`/`caught`, .NET `user-unhandled`/`all`, Go `unrecovered-panic`+`runtime-fatal-throw`, Rust `rust_panic`, C/C++ `cpp_throw` for `"all"` — its `"uncaught"` default sets no filter since uncaught throws crash via SIGABRT, which pauses natively); an explicitly requested unsupported mode is skipped with a warning. Python edge: debugpy treats `sys.exit(n)` with a **non-zero** code as an unhandled `SystemExit` and pauses there (`sys.exit(0)` runs to completion normally) — pass `"none"` if a script legitimately exits non-zero via `sys.exit`.

**Response:**
```json
{
  "success": true,
  "state": "paused",
  "message": "Debugging started for /abs/path/examples/python_simple_swap/swap_vars.py. Current state: paused",
  "data": {
    "message": "Debugging started for /abs/path/examples/python_simple_swap/swap_vars.py. Current state: paused",
    "reason": "breakpoint"
  }
}
```

**Pause Reasons:**
- `"breakpoint"`: Stopped at a breakpoint
- `"step"`: Stopped after a step operation
- `"entry"`: Stopped on entry (if configured)
- `"exception"`: Stopped at an exception (the launch default for most languages; see `breakOnExceptions`). `lastStop.description`/`lastStop.text` carry the exception class and message where the adapter reports them. Where the adapter supports the DAP `exceptionInfo` request (Python, JavaScript, Java, .NET, mock), `lastStop.exceptionInfo` is additionally populated best-effort with `exceptionId`, `breakMode`, and optional `details` (message, type names, adapter-side stack trace). The enrichment is requested asynchronously right after the pause, so it may appear in `list_debug_sessions`/`get_stack_trace` a moment after the stop itself — re-query if it is absent immediately after pausing.

**Exit code:** when the debuggee terminates, the exit code reported by the adapter is surfaced as `exitCode` in `list_debug_sessions`, so a crash (non-zero) is distinguishable from a clean exit.

---

### restart_debugging

Restarts the debuggee in one call: terminates the current program (if still running) and relaunches it with the same configuration as the last `start_debugging`. All current breakpoints are re-applied automatically — the core edit-rerun loop (`fix a line → restart → confirm at the same breakpoints`) becomes a single tool call instead of close/create/re-set/start.

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
- Restart is implemented uniformly as terminate + relaunch (the DAP-spec-blessed emulation; no adapter advertises native restart), so every launch-mode language works identically. Native DAP `restart` is a possible future optimization.
- The launch configuration is replayed verbatim (script, args, `dapLaunchArgs`, `adapterLaunchConfig`, `breakOnExceptions`); there are no per-restart overrides — call `start_debugging` for a different configuration.
- **The output buffer starts fresh**: `outputReset: true` signals that `get_output` cursors from the previous launch are stale — read from `since: 0`.
- Not available for **attach sessions** (no launch configuration to replay — detach and re-attach instead) or for sessions that were never launched (including dry-run-only sessions).

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
  }
}
```

`location` and `context` are best-effort: they appear when the post-step stack trace and the source file could both be read.

#### Pending steps

`step_over`, `step_into`, and `step_out` share one contract. The DAP step request only acknowledges that the debugger accepted the command — where the program lands arrives later, as a `stopped` event — so each tool waits up to ~5s for it. If the step is still executing when that grace window elapses (e.g. stepping over a long-running call), the call still **succeeds**, but with `state: "running"`, a top-level `pending: true`, and no `location`:

```json
{
  "success": true,
  "state": "running",
  "pending": true,
  "message": "Step dispatched; the program is still executing after 5s (e.g. stepping over a long-running call). The session remains 'running' and will become 'paused' when the step completes. Check the session state, or call pause_execution to interrupt."
}
```

The step is not cancelled: the session becomes `"paused"` on its own when it completes (poll `list_debug_sessions`), or call `pause_execution` to interrupt it.

Once a stop has been observed, the stop path owns the answer — a step that demonstrably landed is never reported as pending afterwards, at the cost of the response then being bounded by the stack-trace round trip rather than by the ~5s window. If the debuggee ends while the step is in flight the result is still a success, with a terminal `state` and a message such as `"Step completed as session terminated."`.

Stepping when the session is not paused returns `success: false` with `state` showing the session's actual state; stepping in a terminated session returns an application-level failure (see [Error Handling](#error-handling)).

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

---

### continue_execution

Continues execution until the next breakpoint or program end.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.

**Response:**
```json
{
  "success": true,
  "message": "Continued execution"
}
```

**Error Response:**
```json
{
  "code": -32603,
  "message": "MCP error -32603: Failed to continue execution: Managed session not found: {sessionId}"
}
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
  "data": {
    "message": "Paused",
    "stopReason": "pause",
    "location": { "file": "/path/app.py", "line": 42, "column": 1 }
  }
}
```

**Response** (the program had not stopped when the grace window elapsed):
```json
{
  "success": true,
  "state": "running",
  "data": {
    "message": "Pause requested; no 'stopped' event within 5s (the program may be blocked in native code or a syscall). The session will report 'paused' once the stop lands. Check the session state to confirm.",
    "pending": true
  }
}
```

**Notes:**
- The `"state"` field is the session state at the moment the tool answers: `"paused"` once the stop has been observed, and `"running"` **only on the pending path** — the request was delivered but the program has not stopped yet. On that path, poll `list_debug_sessions` (or watch a subsequent tool call) to see the state flip to `"paused"` when the target next executes code.
- `pending` sits inside `data` here, unlike the step tools, which hoist it to the top level of the response.
- `data.location` is best-effort: it appears on the observed path when the post-stop stack trace could be read.
- When the stop is observed before the tool returns, `data.stopReason` carries the (normalized) stop reason and — if the adapter reported a misleading raw reason that was normalized — `data.rawStopReason` carries the original. Example: CodeLLDB delivers an explicit pause via SIGSTOP and reports `"exception"`; the result is `stopReason: "pause", rawStopReason: "exception"`. js-debug similarly reports pauses as `"step"`. The same raw reason appears as `lastStop.rawReason` in `list_debug_sessions`. Stale stops from before the pause request are never echoed.
- The session must be in a `"running"` state; pausing an already-paused session returns success immediately with `"Already paused"` (plus the current `stopReason`). Any other state fails with `Cannot pause in state: <state>`.
- If the debuggee ends before the pause takes effect, the call still succeeds, reporting `"Session ended before pause took effect"`.
- A session with no debuggable target to pause (e.g. a JavaScript attach whose target session was never adopted, or has ended) fails with an actionable error instead of hanging.
- After pausing, you can inspect variables, evaluate expressions, and step through code

---

## State Inspection

### Secret redaction

Debuggers see everything in scope — including credentials — and when the debugging driver is an AI agent, variable values flow into model context and transcripts. By default, mcp-debugger masks credential-shaped values in every value-bearing surface: `get_variables`, `get_local_variables`, `evaluate_expression` results, and captured output (`get_output` and the `debug://sessions/{id}/output` resource).

Masking is per-token and labeled, so the rest of the value stays legible:

```json
{ "name": "gh_token", "value": "<redacted:github-pat>", "type": "str", "redacted": true }
```

Two detection layers apply:

- **Value shapes** — well-known token formats (GitHub/GitLab PATs, OpenAI/Anthropic-style `sk-` keys, Slack, Stripe, AWS access key IDs, Google API keys, npm/PyPI/Hugging Face tokens, SendGrid, JWTs, PEM private-key blocks, `Bearer` credentials, connection-string passwords, URL userinfo passwords). Patterns are adapted from the MIT-licensed [gitleaks](https://github.com/gitleaks/gitleaks) corpus.
- **Sensitive names** — a variable whose *name* exactly matches a known sensitive name (`password`, `api_key`, `client_secret`, ...) has its whole value masked as `<redacted:sensitive-name>`, unless the value is trivial (`None`, `''`, `0`, ...) so "why is my token empty?" stays debuggable. Matching is exact after normalization, never substring — `tokenCount`, `PATH`, and `patience` are untouched. `evaluate_expression` treats the expression's final dot-segment as the name, so `config.password` is masked like the variable `password`.

Results that had values masked carry a `redaction` field (`{ masked, notice }` on variable/output tools; `{ rules, notice }` on evaluate results) explaining that only the display is masked, not program state. Redacted variables and output entries are flagged `redacted: true`.

**Opting out**: start the server with `DEBUG_MCP_NO_REDACT=1` to disable redaction entirely (e.g. when debugging credential-handling code itself). Adapter stderr sanitization (unconditional, whole-line) is unaffected by this flag.

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
- Frame IDs are used with `get_scopes`
- Internal/runtime frames (e.g. Node.js internals, Go `/runtime/`, `System.*`) are filtered out by default; pass `includeInternals: true` to see them. When any frames were hidden, the response additionally carries `hiddenFrames` (count) and a `note` explaining how to reveal them.
- The filtered stack is never empty when the adapter reported frames: if *every* frame is internal (e.g. a goroutine paused inside the Go runtime), the top internal frame is kept so `get_scopes`/`evaluate_expression` still have a valid `frameId`, and the `note` says so.
- When an explicit thread reports no frames, the response remains anchored to that thread and its `note` suggests a frame-bearing alternative when one is available.
- When the implicit stopped thread is frameless, stack, locals, and default evaluation share one resolver. It scans siblings, prefers a thread whose frames the language policy recognizes as user code over runtime-only stacks, adopts it once, and discloses the switch in `note`/`anchorNote`.
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

If the originally stopped thread has no frames, this tool uses the same user-frame-preferring adopted anchor as `get_stack_trace`. The response's `anchorNote` always names an automatic thread or lower-frame switch.

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
- When `includeSpecial` is true, all variables including internals are returned
- This is especially useful for AI agents that need quick access to current local state

---

### evaluate_expression

Evaluates an expression in the context of the current debug session.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.
- `expression` (string, required): The expression to evaluate.
- `frameId` (number, optional): Authoritative stack frame ID for context. If omitted, evaluation uses the same adopted top frame as `get_stack_trace` and `get_local_variables`; an automatic thread switch is returned as `anchorNote`.
- `timeout` (number, optional): Maximum time in milliseconds to wait for the evaluation to complete (default: 30000, max: 600000). On expiry the request fails but the expression may keep executing in the debuggee.

**Response:**
```json
{
  "success": true,
  "result": "10",
  "type": "int",
  "variablesReference": 0,
  "presentationHint": {}
}
```

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
- `hasMore: true` means more entries matched than `limit` allowed; call again with `since: nextSince`.
- Incremental polling recipe: call once, remember `nextSince`, and pass it as `since` on the next call — you'll only ever see new output.
- Adapter support: Python (`redirectOutput`), JavaScript (`outputCapture: 'std'`), Go (`outputMode: 'remote'`), and Java forward debuggee stdio as output events; .NET typically does as well. Ruby launch mode and Rust on Windows route debuggee stdio to the adapter process; the proxy forwards those lines as synthesized `stdout`/`stderr` events (#222/#223), excluding rdbg's `DEBUGGER:` banners. Ruby **attach** captures nothing — the target's stdio stays wherever the process was started.

#### Output resources & subscriptions

Each session also exposes its captured output as an MCP resource:

- **URI:** `debug://sessions/{sessionId}/output` (`text/plain`) — the verbatim console transcript (all categories interleaved in arrival order).
- **`resources/list`** enumerates one output resource per session; the list changes on session create/close (`notifications/resources/list_changed`).
- **`resources/subscribe`** to a session's URI to receive `notifications/resources/updated` pings as output arrives. Pings are coalesced (~150 ms), so notification volume is independent of how fast the debuggee prints — on a ping, re-read the resource or call `get_output` with your cursor.
- Subscriptions are tracked per server instance and cleaned up when the session closes.

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
        "attach": { "supported": true, "available": true }
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
- `installed[]` keeps its historical meaning: adapter package loadable and not disabled. `count` is its length.
- `available[]` carries one entry per known adapter, with per-mode availability (issue #331) and a `description` when the adapter registry supplies one. `supported` says whether the adapter implements the mode at all; `available` says whether it is usable in this runtime right now (with a `reason` when it isn't).
- Attach for Python and Ruby is a direct connection to a debugpy/rdbg DAP socket, so it stays available even when the local toolchain is missing — the container image uses exactly this to offer Ruby attach without a Ruby runtime.
- Disabled languages (`DEBUG_MCP_DISABLE_LANGUAGES`) stay listed with a disabled reason on both modes.
- `languages[]` is the backward-compatible metadata shape: `id`, `displayName`, `version`, `requiresExecutable`, and `defaultExecutable` for the languages that have one (`mock` does not).

---

### attach_to_process

Attaches the debugger to a running process. Unless you pass `stopOnEntry: false`, the target is verified after the handshake by polling for threads; if none are reported within `verifyTimeout` the attach fails and the proxy is torn down. With `stopOnEntry: false` that verification (and the post-attach pause) is skipped entirely and the session is reported as `running`.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.
- `port` (number, optional): Debug port to attach to.
- `host` (string, optional): Host to attach to (default: `localhost`).
- `processId` (number or string, optional): Process ID, for local attach — language-specific. C/C++ attach is **PID-only**: a host/port attach is rejected as an unsupported operation.
- `timeout` (number, optional): Connection timeout in milliseconds (default: `30000`).
- `verifyTimeout` (number, optional): How long to wait (ms) for the debugger to report at least one thread after attaching before failing the attach (default: `20000`, max: `600000`). Decrease for fast failure-by-design probes; increase for targets that are exceptionally slow to become debuggable. Not used when `stopOnEntry: false` — that path performs no thread verification.
- `sourcePaths` (string[], optional): Source paths for code mapping.
- `stopOnEntry` (boolean, optional): Request a pause immediately after attaching. Anything but `false` — including omitting it — takes the verified path described above; `false` skips both the thread verification and the post-attach pause, and the attach returns `state: "running"`. **Pass `false` when attaching to a live service you still need to use** — this is the opposite of `start_debugging`, whose `stopOnEntry` defaults to `false`. A pause that lands after the response is reported as `pending: true` and named in `message`.
- `justMyCode` (boolean, optional): Only debug user code (skip library code).
- `breakOnExceptions` (string, optional): `"uncaught"`, `"all"`, or `"none"` — same mode semantics as on `start_debugging`, but attach never applies a language default: it stays `"none"` unless requested.
- `adapterConfig` (object, optional): Adapter-specific attach extras, merged into the attach config before the adapter transforms it, mirroring `start_debugging`'s `adapterLaunchConfig` (C/C++/LLDB example: `{"program": "/proc/1/root/pricer"}` for symbol resolution from a kubectl-debug ephemeral container, or `initCommands`; Python example: `{"pathMappings": [{"localRoot": "/home/user/checkout/src", "remoteRoot": "/app"}]}` so breakpoints at local-checkout paths bind against a remote debugpy, issue #450). Reserved keys `request`/`__attachMode` are ignored with a warning; set `stopOnEntry` via the top-level parameter.

**Response:**
```json
{
  "success": true,
  "state": "paused",
  "message": "Attached to process at 127.0.0.1:5678",
  "data": {
    "message": "Attached to process at 127.0.0.1:5678"
  }
}
```

When the requested pause has not landed by the time the tool answers (an idle Node server, say — js-debug's pause lands on the next event-loop dispatch), the response says so:
```json
{
  "success": true,
  "state": "running",
  "pending": true,
  "message": "Attached to process at 127.0.0.1:9229; post-attach pause pending — the target stops when it next executes code (pass stopOnEntry: false to attach without pausing)",
  "data": {
    "message": "Attached to process at 127.0.0.1:9229; post-attach pause pending — the target stops when it next executes code (pass stopOnEntry: false to attach without pausing)",
    "pending": true
  }
}
```

**Notes:**
- `state` is `"paused"` only once a stopped event has actually been observed; otherwise the attach reports `"running"`. When a requested post-attach pause is accepted but its stopped event has not arrived within the bounded wait, the response is successful with `state: "running"` and `pending: true` (at the top level and in `data`) and the `message` names the pending pause; the late stopped event is the only transition to `paused`, and every paused session has a `lastStop`.
- When `processId` was used, the message reads `Attached to process PID <pid>` instead.
- The response `warning` reports two distinct `adapterConfig` key outcomes (issues #450/#466): keys the adapter's attach transform genuinely drops (e.g. Python's ptvsd-era `localRoot`/`remoteRoot` — use `pathMappings`) are named as **ignored**, while keys mcp-debugger doesn't recognize are **forwarded to the adapter as-is** and named with an edit-distance suggestion for near-misses (`pathMapping (did you mean pathMappings?)`) — "ignored" means dropped, "forwarded as-is" means the adapter still sees them. The same field also carries the launch-style warning for function breakpoints still unverified at attach (issue #308).
- js-debug attach honors `adapterConfig` too: `localRoot`/`remoteRoot`/`sourceMaps`/`skipFiles`/`continueOnAttach` and other js-debug attach options reach the debugger (issue #466).
- Breakpoints set before the attach are re-sent once the debuggee-owning session is provably live, so their verified state in `list_breakpoints` is authoritative.
- Languages whose adapter has no attach implementation (`rust`, `go`, `mock`) fail fast with a clear error.
- A failed attach reports `success: false` with the reason in `message` (`Failed to attach: ...`) and tears the proxy down, so no live proxy is left behind; `state` is then `"error"` (or `"stopped"` if the session was already gone). When the failure happened during proxy initialization, `data` carries `proxyLogPath`, `proxyLogResource`, and `initProgress` diagnostics. Session-lifecycle failures (unknown or terminated session) return the standard application-level `error` payload instead — see [Error Handling](#error-handling).

---

### detach_from_process

Detaches the debugger from an attached process, leaving the process running.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.
- `terminateProcess` (boolean, optional): Terminate the process on detach (default: `false`).

**Response:**
```json
{
  "success": true,
  "state": "stopped",
  "message": "Detached from process (process still running)",
  "data": {
    "message": "Detached from process (process still running)"
  }
}
```

**Notes:**
- With `terminateProcess: true` the whole session is closed and the message reads `Detached and terminated process`.
- Detaching sends DAP `disconnect` with `terminateDebuggee: false`, then stops the proxy; the session ends in `"stopped"` either way, so a later re-attach needs a new session.
- Detaching a session with no active debug process reports `success: false` with `No active debug session to detach from` in `message`.

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
  "type": "python",            // your language's debug type — see table below
  "request": "attach",
  "debugServer": 52341,         // the port from expose_session
  "mirrorToken": "<token from expose_session>"
}
```

`debugServer` points VS Code directly at a running DAP server; extra properties like `mirrorToken` are passed through in the attach request, where the mirror validates them.

| Session language | VS Code `type` |
|---|---|
| python | `python` |
| javascript | `node` |
| java | `java` |
| go | `go` |
| rust | `lldb` |
| dotnet | `coreclr` |
| ruby | `rdbg` |

Other DAP clients (nvim-dap, etc.): connect a TCP DAP client to the host/port and include `mirrorToken` in the `attach` request arguments.

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

### redefine_classes

Hot-swap changed Java classes into a running JVM using JDI `VirtualMachine.redefineClasses()`. **Java only.**

**Parameters:**
- `sessionId` (string, required): The debug session ID (must be an active Java session)
- `classesDir` (string, required): Absolute path to compiled classes directory (e.g., `build/classes/java/main/`)
- `sinceTimestamp` (number, optional): Unix timestamp in milliseconds. Only redefine `.class` files modified after this time. `0` or omitted = scan all files.
- `timeout` (number, optional): Maximum time in milliseconds to wait for the redefinition to complete (default: 30000, max: 600000). Increase when hot-swapping many classes at once.

**Response:**
```json
{
  "success": true,
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

**Example — full scan:**
```json
{
  "sessionId": "abc-123",
  "classesDir": "/project/build/classes/java/main"
}
```

**Example — incremental scan (pass `newestTimestamp` from previous call):**
```json
{
  "sessionId": "abc-123",
  "classesDir": "/project/build/classes/java/main",
  "sinceTimestamp": 1711500000000
}
```

**Notes:**
- Only works with Java debug sessions (requires JDI support)
- Classes must already be loaded in the target JVM — unloaded classes are skipped (`skippedNotLoaded`)
- Schema changes (adding/removing methods or fields) will fail for individual classes without blocking others
- The `newestTimestamp` in the response enables incremental workflows: recompile, then pass it as `sinceTimestamp` on the next call to only redefine newly modified files
- The session can be paused or running when calling this tool

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
1. **Session not found**: Occurs when a session terminates unexpectedly
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
