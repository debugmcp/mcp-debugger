# mcp-debugger Tool Reference

This document provides a complete reference for all tools available in mcp-debugger, based on real testing conducted on 2025-06-11.

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
   - [get_stack_trace](#get_stack_trace)
   - [get_scopes](#get_scopes)
   - [get_variables](#get_variables)
   - [get_local_variables](#get_local_variables)
   - [evaluate_expression](#evaluate_expression)
   - [get_source_context](#get_source_context)
   - [get_output](#get_output)
5. [Additional Tools](#additional-tools) — list_supported_languages, attach_to_process, detach_from_process, list_threads
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
- `language` (string, required): The programming language to debug. Languages are discovered dynamically from installed adapters. The default fallback languages (when dynamic discovery is unavailable) are `"python"` and `"mock"`. When all adapters are available, the full list is: `"python"`, `"ruby"`, `"javascript"`, `"rust"`, `"go"`, `"java"`, `"dotnet"`, `"mock"`. The actual list depends on which `@debugmcp/adapter-*` packages are discoverable at runtime.
- `name` (string, optional): A descriptive name for the debug session. Defaults to `"<language>-debug-<timestamp>"` (e.g., `"python-debug-1711500000000"`), built from the session language and `Date.now()`.
- `executablePath` (string, optional): Path to the language interpreter/executable (e.g., Python interpreter path).

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
- When a `port` parameter is provided in `create_debug_session`, the server performs an inline attach (creating the session and immediately attaching to a running process on that port)

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
- `sessionId` (string, required): The ID of the debug session.
- `file` (string, required): Path to the source file (absolute or relative to project root).
- `line` (number, required): Line number where to set breakpoint (1-indexed).
- `statement` (string, optional): **Content addressing** — instead of `line`, pass the exact text of the target line (leading/trailing whitespace ignored), like an Edit-tool match. Cannot land on the wrong line; if the text appears on multiple lines the error lists every match; anchors re-resolve across `restart_debugging` after file edits. Provide `statement` OR `line`, not both. See [Statement anchors](#statement-anchors).
- `function` (string, optional): **Symbol addressing** — break on entry to a function/method by name (DAP function breakpoint). Session-global: no `file` or `line` at all, and names survive edits better than both. Composes with `condition` only. Supported by Python, Go, Rust, .NET, and Java; JavaScript rejects it with a clear error (see [Function breakpoints](#function-breakpoints)).
- `nearLine` (number, optional): With `statement` only — when the statement text appears on multiple lines, bind to the match closest to this line (ties go to the lower line).
- `expectedContent` (string, optional): With `line` only — assert the exact text of the target line (leading/trailing whitespace ignored) before setting. On a mismatch the breakpoint is **not** set and the error shows the actual content of that line and its neighbors — a fast, self-explanatory failure instead of a breakpoint that silently lands on the wrong line. See [Content assertions and loud snapping](#content-assertions-and-loud-snapping).
- `condition` (string, optional): Conditional expression — only break (or log) when it evaluates truthy.
- `logMessage` (string, optional): Create a **logpoint** instead of a pausing breakpoint — see [Logpoints](#logpoints) below.
- `suspendPolicy` (string, optional): Suspend policy when the breakpoint is hit — `"all"` suspends all threads (default), `"thread"` suspends only the event thread. Only supported by the Java/JDI adapter.

**Response:**
```json
{
  "success": true,
  "breakpointId": "28e06119-619e-43c0-b029-339cec2615df",
  "file": "C:\\path\\to\\debug-mcp-server\\examples\\python_simple_swap\\swap_vars.py",
  "line": 9,
  "verified": false,
  "message": "Breakpoint set at C:\\path\\to\\debug-mcp-server\\examples\\python_simple_swap\\swap_vars.py:9",
  "context": {
    "lineContent": "    a = b  # Bug: loses original value of 'a'",
    "surrounding": [
      { "line": 7, "content": "def swap_variables(a, b):" },
      { "line": 8, "content": "    \"\"\"This function is supposed to swap two variables.\"\"\"" },
      { "line": 9, "content": "    a = b  # Bug: loses original value of 'a'" },
      { "line": 10, "content": "    b = a  # Bug: 'b' gets the new value of 'a', not the original" },
      { "line": 11, "content": "    return a, b" }
    ]
  }
}
```

**Important Notes:**
- Breakpoints show `"verified": false` until debugging starts
- The response includes the absolute path even if you provide a relative path
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

- **Matching**: whole-line equality after trimming leading/trailing whitespace. Multi-line input is rejected — anchor on the first line of a multi-line construct.
- **Ambiguity is an error, and the error is the disambiguation UI**: every matching `line: content` pair is listed (capped at 20); add `nearLine` to bind to the closest match.
- **Blank/comment anchors are rejected** (`#`, `//`, `/*` prefixes) — debuggers cannot break there reliably.
- **The anchor is stored on the breakpoint record** (visible in `list_breakpoints`) and **re-resolves on `restart_debugging`**: after you edit the file — the whole point of a debug session — the relaunch re-finds each anchored statement in the current file (the breakpoint's previous line breaks ties between duplicates). Moves are reported in the restart response's `data.anchorResolution.moved`; anchors that no longer match keep their previous line and warn (`data.anchorResolution.stale`) rather than failing the restart or dropping state.
- Same readable-file requirement as `expectedContent` (no Java FQCNs, no attach sessions); composes with `condition`, `logMessage`, and `suspendPolicy` unchanged.
- A matching `expectedContent` alongside `statement` is accepted as redundant; a *different* one is an error (contradictory intent).

#### Function breakpoints

`set_breakpoint {sessionId, function: "process_order", condition?}` breaks on entry to a symbol, with no file or line:

- Session-global, name-addressed — the adapter resolves the symbol across the whole program, and the name survives any file edit. `restart_debugging` re-applies them natively.
- Composes with `condition` only (`logMessage` and `suspendPolicy` have no DAP function-breakpoint form; file/line/statement/expectedContent are contradictory and rejected).
- The response and `list_breakpoints` report the adapter's bound location as `boundFile`/`boundLine` once verified. `list_breakpoints` returns function breakpoints in a separate `functionBreakpoints` array (excluded when filtering by file); `remove_breakpoint` accepts `function: "name"` or the breakpoint id; an unscoped `clear_breakpoints` removes them, a file-scoped clear does not.
- Support is adapter-gated: Python, Go, Rust, .NET, Java, and JavaScript work; Ruby is accepted with a warning and validated against the adapter's live capabilities at launch.
- Java names may be bare (`helper`), class-qualified (`Foo.helper`, `com.example.Foo.helper`, `Outer.Inner.helper`), or constructors (`Foo.<init>`). Every concrete overload binds (the reported `boundLine` is the first); classes not yet loaded bind on load and report through breakpoint events. Bare names skip JDK-internal classes (`java.*`, `javax.*`, `sun.*`, `jdk.*`, `com.sun.*`) — qualify the class to target those.
- **JavaScript semantics differ by design** (js-debug implements no DAP function breakpoints upstream — vscode-js-debug#952 — so ours are delivered over js-debug's CDP proxy via V8's `Debugger.setBreakpointOnFunctionCall`, the same primitive behind Chrome DevTools' `debug(fn)`). The name is a **dotted runtime path** (`handler`, `obj.method`, `globalThis.tick`), resolved side-effect-free against the top paused frame's scope (or global scope while running) and **bound to the function value it resolves to at that moment** — it is *not* a source-symbol search ("all functions named X" is not the contract), and reassigning the property later does not move the breakpoint. Top-level `function` declarations of the main module bind at launch; `const fn = ...` and functions in lazily-loaded modules stay `verified: false` with an explanatory message and bind automatically at the next pause. Names resolve against runtime names, not TypeScript/minified source names. Launch and attach modes both work (attach has no entry pause, so module-scoped names bind at the first pause after attach).

#### Logpoints

Passing `logMessage` turns the breakpoint into a DAP logpoint: when the line is hit the program does **not** pause — the message is logged and execution continues at full speed. Expressions in `{curly braces}` are interpolated with live values (e.g. `"order={orderId} total={total}"`), and the messages arrive in the session output, readable via [`get_output`](#get_output) and the `debug://sessions/{id}/output` resource. `condition` may be combined with `logMessage` — the message is only logged when the condition holds.

This is the prod-safe just-in-time diagnostics primitive: attach to a live process, plant logpoints at suspect lines, read interpolated values from `get_output` — no pauses, no pre-instrumented logging.

Support is adapter-dependent:

| Adapters | Behavior |
|---|---|
| Python, JavaScript/TypeScript, Go, Rust, mock | Supported — logs without pausing |
| Java, .NET | Not supported — `set_breakpoint` with `logMessage` fails fast with a clear error |
| Ruby | Unknown — accepted with a warning; validated against the adapter's capabilities at launch |

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

Removes one breakpoint by id, or every breakpoint at a `file` + `line` location. Takes effect immediately while the program is running or paused (the file's remaining breakpoint set is re-sent to the adapter); also works after the program exits, so breakpoints can be adjusted before a relaunch.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.
- `breakpointId` (string, optional): Breakpoint id from `set_breakpoint` or `list_breakpoints`. Takes precedence over `file` + `line`.
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
- An unknown `breakpointId` (or an empty location) returns `success: false` with an explanatory error.
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
- `scriptPath` (string, required): Path to the script to debug.
- `args` (array of strings, optional): Command line arguments for the script.
- `dapLaunchArgs` (object, optional): Standard DAP launch arguments:
  - `stopOnEntry` (boolean): Stop at first line
  - `justMyCode` (boolean): Debug only user code
- `adapterLaunchConfig` (object, optional): Adapter-specific launch configuration overrides. Use this for language-specific settings that go beyond standard DAP arguments (e.g., `mainClass` and `classpath` for Java, `buildCommand` for Rust).
- `dryRunSpawn` (boolean, optional): Test spawn without actually starting
- `breakOnExceptions` (string, optional): `"uncaught"` pauses at uncaught exceptions at the crash site (stack and locals inspectable) instead of terminating the session; `"all"` also pauses on caught/raised exceptions (language-dependent). **Launch sessions default to `"uncaught"`** (issue #244) — a crashing script pauses with `lastStop.reason: "exception"` instead of terminating; pass `"none"` to opt out and let it run to termination. Ruby is the exception: rdbg has no uncaught-only filter, so Ruby launches stay `"none"` by default (only explicit `"all"` is available). Attach sessions never apply a language default. The abstract mode maps to per-language debugger filters (e.g. Python `uncaught`/`raised`, JavaScript `uncaught`/`all`, Java `uncaught`/`caught`, .NET `user-unhandled`/`all`, Go `unrecovered-panic`+`runtime-fatal-throw`, Rust `rust_panic`); an explicitly requested unsupported mode is skipped with a warning. Python edge: debugpy treats `sys.exit(n)` with a **non-zero** code as an unhandled `SystemExit` and pauses there (`sys.exit(0)` runs to completion normally) — pass `"none"` if a script legitimately exits non-zero via `sys.exit`.

**Response:**
```json
{
  "success": true,
  "state": "paused",
  "message": "Debugging started for examples/python_simple_swap/swap_vars.py. Current state: paused",
  "data": {
    "message": "Debugging started for examples/python_simple_swap/swap_vars.py. Current state: paused",
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
  "message": "Stepped over"
}
```

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
  "message": "Stepped into"
}
```

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
  "message": "Stepped out"
}
```

---

### continue_execution

Continues execution until the next breakpoint or program end.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.

**Response:**
```json
{
  "success": true,
  "state": "running",
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

Pauses a running program. The debugger sends a DAP pause request and returns immediately; the paused state is updated asynchronously when the stopped event arrives.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.

**Response:**
```json
{
  "success": true,
  "state": "running",
  "data": {
    "message": "Execution paused"
  }
}
```

**Notes:**
- The `"state"` field in the response reflects the session state at the moment the pause request is acknowledged, which is still `"running"`. The state transitions to `"paused"` asynchronously when the stopped event arrives from the debug adapter; poll `list_debug_sessions` or wait for subsequent tool calls to observe the paused state.
- When the stop is observed before the tool returns, `data.stopReason` carries the (normalized) stop reason and — if the adapter reported a misleading raw reason that was normalized — `data.rawStopReason` carries the original. Example: CodeLLDB delivers an explicit pause via SIGSTOP and reports `"exception"`; the result is `stopReason: "pause", rawStopReason: "exception"`. js-debug similarly reports pauses as `"step"`. The same raw reason appears as `lastStop.rawReason` in `list_debug_sessions`. Stale stops from before the pause request are never echoed.
- The session must be in a `"running"` state; pausing an already-paused session returns success immediately with `"Already paused"` (plus the current `stopReason`)
- After pausing, you can inspect variables, evaluate expressions, and step through code

---

## State Inspection

### get_stack_trace

Gets the current call stack.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.

**Response:**
```json
{
  "success": true,
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
- Frame IDs are used with `get_scopes`

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

---

### get_local_variables

Gets local variables by traversing all stack frames and their scopes, then using the language adapter's policy to extract the relevant local variables. This is a convenience tool that collects scopes and variables across all frames (not just the top frame) so that closures and outer-scope locals are included, then returns the filtered result without needing to manually call stack→scopes→variables.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.
- `includeSpecial` (boolean, optional): Include special/internal variables like `this`, `__proto__`, `__builtins__`, etc. Default: false.

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
- **JavaScript**: Looks for "Local", "Local:", or "Block:" scopes, filters out `this`, `__proto__`, and V8 internals
- **Other Languages**: Falls back to generic behavior (first non-global scope)

**Notes:**
- Session must be paused at a breakpoint for this tool to work
- The tool traverses all frames in the call stack and collects scopes/variables from each, then uses the adapter policy to extract relevant locals (the reported frame is still the top frame)
- When `includeSpecial` is true, all variables including internals are returned
- This is especially useful for AI agents that need quick access to current local state

---

### evaluate_expression

Evaluates an expression in the context of the current debug session.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.
- `expression` (string, required): The expression to evaluate.
- `frameId` (number, optional): Stack frame ID for context. If not provided, automatically uses the current (top) frame.
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
- `file` (string, required): Path to the source file (absolute or relative to project root).
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
  "file": "test_script.py",
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
- Adapter-internal `telemetry` events are filtered out at capture time; all other categories (`stdout`, `stderr`, `console`, `important`, ...) are kept. Adapters that omit a category default to `console`.
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

---

## Additional Tools

The following tools are also available but are not fully documented with examples here:

- **list_supported_languages**: Lists all supported debugging languages with metadata (installed status, display name, default executable). Takes no parameters.
- **attach_to_process**: Attaches the debugger to a running process. Parameters include `sessionId`, `processId` or connection details, adapter-specific attach configuration, and optionally `breakOnExceptions` (same mode semantics as on `start_debugging`, but attach never applies a language default — it stays `"none"` unless requested).
- **detach_from_process**: Detaches the debugger from an attached process. Parameters include `sessionId` and optional `terminateProcess` flag.
- **list_threads**: Lists all threads in the debug session. Parameters include `sessionId`.

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
- Answered locally: `initialize` (from the adapter's real capabilities, with control affordances masked off), `attach`/`launch` (token check), `configurationDone`, `disconnect` (that client only), `cancel`.
- Forwarded to the live adapter: `threads`, `stackTrace`, `scopes`, `variables`, `source`, `evaluate`, `exceptionInfo`, `loadedSources`, `modules`.
- Soft-succeeded so IDE attach flows survive: `setBreakpoints`/`setFunctionBreakpoints` (reported unverified — breakpoints stay agent-owned), `setExceptionBreakpoints`.
- Rejected with a quiet error: `continue`, `next`, `stepIn`, `stepOut`, `pause`, `setVariable`, `restart`, `terminate`, and every other control or mutation request.

On attach while the session is paused, the mirror replays the last stop as a `stopped` event, so the IDE lands directly on the paused frame.

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

Session-lifecycle failures (unknown/terminated session, proxy not running) are application-level failures: they return `{ "success": false, "error": "..." }` rather than an MCP transport error.

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

---

## Best Practices

1. **Always check session state** before performing operations
2. **Use absolute paths** for files to avoid ambiguity
3. **Get scopes before variables** - you need the variablesReference
4. **Handle session termination** gracefully - sessions can end unexpectedly
5. **Set breakpoints on executable lines** - avoid comments and declarations

---

*Last updated: 2026-03-18 based on source code review of mcp-debugger v0.19.0*
