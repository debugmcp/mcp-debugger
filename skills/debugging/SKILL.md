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
2. set_breakpoint         {sessionId, file: "<ABSOLUTE path>", line: N}
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
- **Always `close_debug_session`** when done — it tears down the debuggee process tree.

## Root-cause discipline

1. State a hypothesis about where reality diverges from expectation *before* setting breakpoints.
2. Set at most two breakpoints: last-known-good and first-known-bad. Run, inspect, halve the interval. Bisection beats stepping line-by-line from the top.
3. At each pause, record what you *learned* (variable values, actual control flow), not just where you are.
4. When the diverging line is found, inspect every input to that line before concluding — the bug is usually an operand, not the operator.
5. Fix, then re-run the same session recipe to confirm the observed state changed as predicted.

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

## Crash diagnosis

- Launch sessions pause at uncaught exceptions **by default** (`breakOnExceptions: "uncaught"`) with the stack and locals live instead of losing the session — pass `"none"` to opt out, or `"all"` to also stop on caught raises (language-dependent). Ruby is the exception: rdbg has no uncaught-only filter, so Ruby crashes still run to termination unless you pass `"all"`. Attach sessions apply no default — pass the mode explicitly.
- On an exception stop, `lastStop.description`/`lastStop.text` carry the exception class and message; where the adapter supports it (Python, JS, Java, .NET), `lastStop.exceptionInfo` adds `exceptionId`, `breakMode`, and details (it lands a moment after the pause — re-query if absent). After termination, `exitCode` in `list_debug_sessions` distinguishes a crash (non-zero) from a clean exit.

## Current limitations (be honest with yourself)

- No breakpoint listing/removal tools yet: track what you set; re-creating the session resets breakpoints.
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
