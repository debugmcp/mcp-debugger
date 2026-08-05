/**
 * In-band agent guidance served over MCP.
 *
 * SERVER_INSTRUCTIONS is sent once in the initialize handshake (the MCP
 * `instructions` field); DEBUGGING_WORKFLOW_PROMPT backs the
 * `debugging-workflow` prompt. Both are condensed views of the full agent
 * skill in skills/debugging/ — when editing one, check the other and the
 * skill for drift.
 */

export const SERVER_INSTRUCTIONS = `mcp-debugger drives real step-through debuggers (Python, JavaScript/TypeScript, Ruby, Rust, Go, Java, .NET) as MCP tools.

Golden path: create_debug_session -> set_breakpoint (ABSOLUTE file path) -> start_debugging (ABSOLUTE scriptPath) -> get_stack_trace -> get_scopes(frameId from the stack frame's "id" field) -> get_variables / get_local_variables / evaluate_expression -> step_* or continue_execution -> get_output -> close_debug_session (always, even on failure).

Key rules:
- Stepping/evaluation/variable reads require the session to be PAUSED; the stop reason on each pause tells you why it stopped.
- If a variable entry has a variablesReference, call get_variables with it to expand children.
- Breakpoints may report unverified until the module/class loads — that is normal.
- list_breakpoints shows every breakpoint with its verified state; remove_breakpoint (by id or file+line) and clear_breakpoints take effect immediately, even mid-run — use them to move a bisection window without restarting.
- get_output returns buffered debuggee stdout/stderr with a cursor; pass nextCursor back to read only new output.
- attach_to_process connects to running/remote targets (debugpy --listen, rdbg --open, JVM JDWP), including pods via port-forward.
- Launch sessions pause at uncaught exceptions by default (breakOnExceptions "uncaught"; Ruby excepted — rdbg has no uncaught filter). Pass "none" to let crashing scripts run to termination; attach applies no default.

For the full debugging workflow (root-cause discipline, per-language quirks), request the "debugging-workflow" prompt or install the agent skill from skills/debugging/ in the repo.`;

export const DEBUGGING_WORKFLOW_PROMPT = `# Debugging workflow (mcp-debugger)

Prefer the debugger over print-debugging whenever you would need more than one edit-run cycle to see program state.

## Golden path (launch)
1. create_debug_session {language} -> sessionId
2. set_breakpoint {sessionId, file: ABSOLUTE path, line}
3. start_debugging {sessionId, scriptPath: ABSOLUTE path}
4. get_stack_trace {sessionId} — use each frame's "id" field; it is adapter-assigned, never assume 0
5. get_scopes {sessionId, frameId} -> variablesReference per scope
6. get_variables {sessionId, scope: variablesReference} or get_local_variables {sessionId}
7. evaluate_expression {sessionId, expression}
8. step_over / step_into / step_out / continue_execution
9. get_output {sessionId} — cursor-based; pass nextCursor back for only-new output
10. close_debug_session {sessionId} — ALWAYS, even after errors

## Root-cause discipline
- State a hypothesis before setting breakpoints.
- Set two breakpoints: last-known-good and first-known-bad; run, inspect, halve the interval (bisection beats line-by-line stepping). Use remove_breakpoint / clear_breakpoints to move the window mid-session, and list_breakpoints to see what is set.
- At each pause record what you learned, not just where you are.
- When you find the diverging line, inspect every operand before concluding.
- After fixing, re-run the same recipe to confirm the state changed as predicted.

## Session state rules
- PAUSED is required for stepping, evaluation, and variable reads; RUNNING follows continue_execution.
- Each pause carries a stop reason (breakpoint, step, entry, exception...).
- Variable entries with a variablesReference are containers — expand them with get_variables.
- Breakpoints may verify late (debugpy, JDI defer until load) — not an error.

## Attach / remote
attach_to_process {sessionId, host, port, localRoot, remoteRoot}
- Python: target started with "python -m debugpy --listen host:port ..."
- Ruby: target started with "rdbg --open --port N ..." (works via kubectl port-forward)
- Java: JVM flag -agentlib:jdwp=transport=dt_socket,server=y,address=*:PORT (breakpoints defer until class load)
detach_from_process leaves the target running.

## Per-language quirks (one-liners)
- Python: expand the "special variables" container; breakpoints verify after module load.
- JavaScript/TS: internals are filtered from stacks; entry pause auto-continues when stopOnEntry=false.
- Ruby: launch always pauses at load then auto-continues; stdout capture currently has gaps (#222) — verify state via evaluate_expression.
- Rust: scriptPath is the source file (adapter resolves the Cargo project); Windows needs the GNU toolchain.
- Go: Delve native DAP; stdout capture gap (#225) — verify via evaluate_expression.
- Java: compile with javac -g; FQCN accepted as breakpoint "file"; redefine_classes hot-swaps changed classes.
- .NET: scriptPath is the compiled .dll; PDBs must be Portable format.

## Crash diagnosis
- Launch sessions pause at uncaught exceptions by default with stack + locals live ("none" opts out; "all" also stops on caught raises; Ruby has no uncaught filter so its crashes still terminate). Attach applies no default.
- lastStop.description/text carry the exception class and message; where supported (Python/JS/Java/.NET), lastStop.exceptionInfo adds exceptionId/breakMode/details a moment after the pause. exitCode in list_debug_sessions distinguishes a crash (non-zero) from a clean exit.

The full skill (with per-language reference files) lives in skills/debugging/ of the mcp-debugger repo.`;
