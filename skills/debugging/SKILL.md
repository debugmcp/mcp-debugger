---
name: mcp-debugger
description: Use when investigating a bug, failing test, or unexpected runtime behavior and the mcp-debugger MCP server is available — drives real step-through debuggers (breakpoints, stack traces, variable inspection, expression evaluation) for Python, JavaScript/TypeScript, Ruby, Rust, Go, Java, and .NET/C#, locally or attached to remote processes.
---

# Debugging with mcp-debugger

mcp-debugger exposes real language debuggers as MCP tools. Prefer it over print-debugging whenever you would otherwise need more than one edit-run cycle to see program state: a breakpoint plus `evaluate_expression` answers in one run what printf answers in three.

## When to reach for the debugger

- A test fails and the assertion message doesn't explain *why* the value is wrong.
- Control flow surprises you (a branch that "can't happen", a loop that exits early).
- State mutates somewhere between two known-good points and you need to bisect.
- The bug lives in code you can't easily edit (third-party package, compiled artifact).
- You need ground truth about runtime types/values instead of inferring them from source.

Do NOT reach for it when a single glance at the code or one log line would answer the question — session setup costs a few seconds and the target must be runnable.

## The golden path (launch)

```text
1. create_debug_session   {language: "python"}                 -> sessionId
2. set_breakpoint         {sessionId, file: "<ABSOLUTE path>", statement: "<exact line text>"}   (or line: N + expectedContent)
3. start_debugging        {sessionId, scriptPath: "<ABSOLUTE path>"}
4. get_stack_trace        {sessionId}                          -> frames (use frame.id, never assume 0)
5. get_scopes             {sessionId, frameId: <frame.id>}     -> scope variablesReference
6. get_variables          {sessionId, scope: <variablesReference>}
   ... or get_local_variables {sessionId} for the common case
7. evaluate_expression    {sessionId, expression: "x + y"}
8. step_over / step_into / step_out / continue_execution
9. get_output             {sessionId}                          -> captured debuggee stdout/stderr
10. close_debug_session   {sessionId}                          -> ALWAYS, even on failure
```

Rules that prevent 90% of failed sessions:

- **Absolute paths only** for `file` and `scriptPath` (relative paths are rejected in host mode).
- **Use real frame IDs.** Take `id` from `get_stack_trace` frames; it is adapter-assigned and is not 0-indexed.
- **Expand variable containers.** If a variable entry carries a `variablesReference`, call `get_variables` again with that reference to see children (Python's "special variables", object fields, array elements).
- **Respect session state.** Stepping, evaluation, and variable reads require `PAUSED`. After `continue_execution` the session is `RUNNING`; after a step or breakpoint hit it returns to `PAUSED` with a persisted stop reason telling you why it stopped (`breakpoint`, `step`, `entry`, `exception`, ...).
- **Breakpoints may verify late.** Some adapters (debugpy, JDI) report breakpoints unverified until the module/class loads; that is normal, not an error.
- **`<redacted:...>` placeholders are masking, not program state.** Credential-shaped values and values of sensitive variable names (`password`, `api_key`, ...) are masked by default in variable/evaluate/output results; a `redaction` field reports what was hidden. The real value is intact in the debuggee — don't "fix" it, and don't retry the read. The user can disable masking by restarting the server with `DEBUG_MCP_NO_REDACT=1`.
- **If `get_variables` demands `names`, the server is in least-privilege mode** (`DEBUG_MCP_VARIABLE_ACCESS=explicit`): pass the exact variable names you need (`names: ["user", "total"]`; case-sensitive, misses reported in `notFound`) instead of dumping the scope. `evaluate_expression` still works for targeted reads.
- **Always `close_debug_session`** when done — it tears down the debuggee process tree.

## Root-cause discipline

1. State a hypothesis about where reality diverges from expectation *before* setting breakpoints.
2. Set at most two breakpoints: last-known-good and first-known-bad. Run, inspect, halve the interval. Bisection beats stepping line-by-line from the top. Move the window mid-session with `remove_breakpoint` / `clear_breakpoints`; `list_breakpoints` shows what is currently set (with verified state and adapter ids).
   - Prefer `statement: "<exact line text>"` over line numbers: it matches like an Edit-tool `old_string` (whole line, whitespace-trimmed), cannot land on the wrong line, lists every occurrence on ambiguity (add `nearLine` to pick one), and re-resolves across `restart_debugging` after you edit the file. When you do address by line, pass `expectedContent: "<exact line text>"` so a stale or off-by-one line number fails immediately with the actual nearby lines. A response saying `requested line N, bound to line M` means the adapter moved the breakpoint — trust the bound line.
   - `function: "name"` breaks on entry to a symbol with no file or line at all — names survive edits best. Supported by Python/Go/Rust/.NET/Java/JavaScript (Java accepts bare `method`, `Class.method`, or fully-qualified names and binds every concrete overload; JavaScript names are dotted runtime paths like `obj.method` bound to the current function value — main-module function declarations bind at launch, functions in lazily-loaded modules bind at the next pause).
3. When pausing is too disruptive (hot loops, live or attached processes), use a **logpoint**: `set_breakpoint` with `logMessage: "x={x}"` streams interpolated values into `get_output` without stopping the program (Python/JS/Go/Rust; Java and .NET reject it with a clear error).
4. At each pause, record what you *learned* (variable values, actual control flow), not just where you are.
5. When the diverging line is found, inspect every input to that line before concluding — the bug is usually an operand, not the operator.
6. Fix, then `restart_debugging {sessionId}` — one call relaunches with the same configuration and re-applies every breakpoint (the output buffer resets; read `get_output` from `since: 0`). Confirm the observed state changed as predicted. Works even after the program exited; attach sessions are rejected (detach and re-attach instead).

## Program output

`get_output {sessionId}` returns buffered debuggee stdout/stderr with a cursor: pass the returned `nextCursor` back as `cursor` to read only new output. Each session also exposes the transcript as MCP resource `debug://sessions/{id}/output` with subscription support. Caveat: on Ruby, Go, and Rust, debuggee stdout capture currently has gaps (issues #222/#225/#223) — for those languages, verify behavior via `evaluate_expression`/breakpoints rather than stdout, or have the program write a file.

## Attach instead of launch

For an already-running process (including remote machines, containers, and Kubernetes pods via port-forward):

```text
attach_to_process {sessionId, host: "localhost", port: 5678, localRoot: "<local src>", remoteRoot: "<remote src>"}
```

- **Python**: target ran `python -m debugpy --listen <host>:<port> ...`
- **Ruby**: target ran `rdbg --open --port <port> ...` (works through `kubectl port-forward`)
- **Java**: target JVM has `-agentlib:jdwp=transport=dt_socket,server=y,address=*:<port>`; breakpoints in not-yet-loaded classes are deferred automatically

`detach_from_process` leaves the target running; `close_debug_session` after detach cleans up the session.

## IDE mirror (let a human look around)

When a human wants to inspect your live session in their IDE — CI flake parked at the failing state, a long-running attach session that hit an anomaly — expose it:

```text
expose_session {sessionId}  ->  {host: "127.0.0.1", port, token}
```

Relay the endpoint with a ready-to-paste VS Code config: `{"name": "Mirror", "type": "<language's debug type>", "request": "attach", "debugServer": <port>, "mirrorToken": "<token>"}`. Their IDE attaches read-only and lands directly on the paused frame: stacks, scopes, variables, and evaluate all work; stepping, continuing, and breakpoint changes are rejected — execution control stays with you. `unexpose_session {sessionId}` disconnects IDE clients and closes the endpoint (it also closes on session close/restart/exit). Loopback-only; the token is required and should be treated as sensitive.

## Crash diagnosis

- Launch sessions pause at uncaught exceptions **by default** (`breakOnExceptions: "uncaught"`) with the stack and locals live instead of losing the session — pass `"none"` to opt out, or `"all"` to also stop on caught raises (language-dependent). Ruby is the exception: rdbg has no uncaught-only filter, so Ruby crashes still run to termination unless you pass `"all"`. Attach sessions apply no default — pass the mode explicitly.
- On an exception stop, `lastStop.description`/`lastStop.text` carry the exception class and message; where the adapter supports it (Python, JS, Java, .NET), `lastStop.exceptionInfo` adds `exceptionId`, `breakMode`, and details (it lands a moment after the pause — re-query if absent). After termination, `exitCode` in `list_debug_sessions` distinguishes a crash (non-zero) from a clean exit.

## Current limitations (be honest with yourself)

- `pause_execution` support varies by adapter; prefer breakpoints over pausing a free-running program.

## Language specifics

Read the matching reference before your first session in a language — each has load-bearing quirks:

| Language | Reference | Headline quirk |
|---|---|---|
| Python | references/python.md | expand "special variables" containers; late breakpoint verification |
| JavaScript/TS | references/javascript.md | child-session architecture; internals filtered from stacks |
| Ruby | references/ruby.md | entry pause auto-continued; stdout capture gap (#222) |
| Rust | references/rust.md | GNU toolchain on Windows; scriptPath = source file, adapter finds Cargo project |
| Go | references/go.md | Delve native DAP; stdout capture gap (#225) |
| Java | references/java.md | javac -g required; FQCN breakpoints; redefine_classes hot-swap |
| .NET/C# | references/dotnet.md | scriptPath = compiled .dll; Portable PDB required |
| C/C++ | references/cpp.md | scriptPath = binary (-gdwarf-4 -O0) or lone .c/.cpp (auto-compiled); attach by PID; MinGW/DWARF on Windows |
