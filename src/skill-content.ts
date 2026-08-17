/**
 * In-band agent guidance served over MCP.
 *
 * SERVER_INSTRUCTIONS is sent once in the initialize handshake (the MCP
 * `instructions` field); DEBUGGING_WORKFLOW_PROMPT backs the
 * `debugging-workflow` prompt. Both are condensed views of the full agent
 * skill in skills/debugging/ — when editing one, check the other and the
 * skill for drift.
 *
 * Both texts are built per addressing mode (issue #271): the
 * DEBUG_MCP_BP_ADDRESSING flag must hide content-addressing features from
 * every surface a client can learn from, instructions included.
 */
import {
  BpAddressingMode,
  DEFAULT_BP_ADDRESSING,
  supportsExpectedContent,
  supportsStatementAnchors
} from './utils/bp-addressing.js';

export function buildServerInstructions(
  mode: BpAddressingMode = DEFAULT_BP_ADDRESSING,
  opts: { redactionEnabled?: boolean; variableAccessMode?: 'open' | 'explicit' } = {}
): string {
  // Default matches the runtime default: redaction is on unless the server
  // was started with DEBUG_MCP_NO_REDACT=1 (issue #237).
  const redactionRule = (opts.redactionEnabled ?? true)
    ? `\n- Credential-shaped values (API keys, tokens, private keys) and values of sensitive variable names (password, api_key, ...) render as <redacted:rule-id> placeholders in variable/evaluate/output results — the program's real state is unchanged, only the display is masked. A "redaction" field reports what was masked; the user can disable this by restarting the server with DEBUG_MCP_NO_REDACT=1.`
    : '';
  const variableAccessRule = opts.variableAccessMode === 'explicit'
    ? `\n- This server runs in least-privilege variable access mode (DEBUG_MCP_VARIABLE_ACCESS=explicit): get_variables and get_local_variables require names:["..."] — request only the variables you need (names are exact and case-sensitive; missing ones are listed in notFound). evaluate_expression remains available for targeted reads.`
    : '';
  const expectedContentRule = supportsExpectedContent(mode)
    ? `\n- set_breakpoint accepts expectedContent — pass the text of the target line or a distinctive substring of it (whitespace-trimmed, trailing //- or #-comments ignored); a mismatch fails fast and shows the actual nearby lines, catching off-by-one line numbers before they cause a confusing session. A response reporting "requested line N, bound to line M" means the adapter moved your breakpoint — trust the bound line.`
    : '';
  const statementRule = supportsStatementAnchors(mode)
    ? `\n- Prefer set_breakpoint {statement: "<line text>"} over line numbers: it matches like an Edit-tool old_string (whole line or a distinctive substring — whitespace-trimmed, trailing comments ignored, exact matches win), cannot land on the wrong line, lists every occurrence on ambiguity (disambiguate with nearLine), and re-resolves across restart_debugging after you edit the file.\n- set_breakpoint {function: "name"} breaks on entry to a symbol with no file or line at all — names survive edits best (Python/Go/Rust/.NET/Java/JavaScript; JS names are dotted runtime paths and functions in lazily-loaded modules bind at the next pause).`
    : '';

  return `mcp-debugger drives real step-through debuggers (Python, JavaScript/TypeScript, Ruby, Rust, Go, Java, .NET) as MCP tools.

Golden path: create_debug_session -> set_breakpoint (ABSOLUTE file path) -> start_debugging (ABSOLUTE scriptPath) -> get_stack_trace -> get_scopes(frameId from the stack frame's "id" field) -> get_variables / get_local_variables / evaluate_expression -> step_* or continue_execution -> get_output -> close_debug_session (always, even on failure).

Key rules:
- Stepping/evaluation/variable reads require the session to be PAUSED; the stop reason on each pause tells you why it stopped.
- If a variable entry has a variablesReference, call get_variables with it to expand children.
- Breakpoints may report unverified until the module/class loads — that is normal.
- list_breakpoints shows every breakpoint with its verified state; remove_breakpoint (by id or file+line) and clear_breakpoints take effect immediately, even mid-run — use them to move a bisection window without restarting.${statementRule}${expectedContentRule}
- Logpoints: set_breakpoint with logMessage ("order={orderId}") logs the interpolated message to get_output WITHOUT pausing — the prod-safe way to watch values on a hot path (Python/JS/Go/Rust; not Java/.NET).
- restart_debugging {sessionId} relaunches with the same config in one call — breakpoints re-apply automatically, output buffer resets (read get_output from since=0). Works after the program exits; not for attach sessions.
- get_output returns buffered debuggee stdout/stderr with a cursor; pass nextCursor back to read only new output.
- attach_to_process connects to running/remote targets (debugpy --listen, rdbg --open, JVM JDWP), including pods via port-forward.
- expose_session {sessionId} returns host/port/token for a read-only IDE mirror of the live session (VS Code launch.json: "debugServer": port + "mirrorToken"); relay these to the human, unexpose_session when done. The IDE observes — execution control stays with you.
- Launch sessions pause at uncaught exceptions by default (breakOnExceptions "uncaught"; Ruby excepted — rdbg has no uncaught filter). Pass "none" to let crashing scripts run to termination; attach applies no default.${redactionRule}${variableAccessRule}

For the full debugging workflow (root-cause discipline, per-language quirks), request the "debugging-workflow" prompt or install the agent skill from skills/debugging/ in the repo.`;
}

export const SERVER_INSTRUCTIONS = buildServerInstructions();

export function buildDebuggingWorkflowPrompt(
  mode: BpAddressingMode = DEFAULT_BP_ADDRESSING
): string {
  const setBreakpointStep = supportsStatementAnchors(mode)
    ? '2. set_breakpoint {sessionId, file: ABSOLUTE path, statement: "<line text or distinctive substring>"} — content addressing beats line numbers (cannot land on the wrong line; nearLine disambiguates repeats; anchors re-resolve across restart_debugging). Line + expectedContent works too'
    : supportsExpectedContent(mode)
      ? '2. set_breakpoint {sessionId, file: ABSOLUTE path, line} — add expectedContent: "<line text or distinctive substring>" so a stale or off-by-one line number fails fast instead of binding somewhere surprising'
      : '2. set_breakpoint {sessionId, file: ABSOLUTE path, line}';

  return `# Debugging workflow (mcp-debugger)

Prefer the debugger over print-debugging whenever you would need more than one edit-run cycle to see program state.

## Golden path (launch)
1. create_debug_session {language} -> sessionId
${setBreakpointStep}
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
- When pausing is too disruptive (hot loops, live/attached processes), use a logpoint instead: set_breakpoint with logMessage "x={x}" streams interpolated values into get_output at full speed (Python/JS/Go/Rust).
- At each pause record what you learned, not just where you are.
- When you find the diverging line, inspect every operand before concluding.
- After fixing, restart_debugging re-runs the same recipe in one call (same config, breakpoints re-applied) to confirm the state changed as predicted.

## Session state rules
- PAUSED is required for stepping, evaluation, and variable reads; RUNNING follows continue_execution.
- Each pause carries a stop reason (breakpoint, step, entry, exception...).
- Variable entries with a variablesReference are containers — expand them with get_variables.
- Breakpoints may verify late (debugpy, JDI defer until load) — not an error.

## Attach / remote
attach_to_process {sessionId, host, port, sourcePaths, adapterConfig}
- Python: target started with "python -m debugpy --listen host:port ..."
- Ruby: target started with "rdbg --open --port N ..." (works via kubectl port-forward)
- Java: JVM flag -agentlib:jdwp=transport=dt_socket,server=y,address=*:PORT (breakpoints defer until class load)
detach_from_process leaves the target running.

## IDE mirror (human inspection)
When a human wants to look around in their IDE, expose_session {sessionId} opens a read-only DAP endpoint (127.0.0.1, token-gated) on the live session — even mid-pause. Relay host/port/token with a VS Code launch.json snippet: {"request": "attach", "debugServer": <port>, "mirrorToken": "<token>", "type": <language's debug type>}. The IDE lands on the paused frame and can walk stacks/variables/evaluate; stepping and breakpoints stay yours. unexpose_session closes it.

## Per-language quirks (one-liners)
- Python: expand the "special variables" container; breakpoints verify after module load.
- JavaScript/TS: internals are filtered from stacks; entry pause auto-continues when stopOnEntry=false.
- Ruby: launch always pauses at load then auto-continues; stdout capture currently has gaps (#222) — verify state via evaluate_expression.
- Rust: scriptPath is the source file (adapter resolves the Cargo project); Windows needs the GNU toolchain.
- Go: Delve native DAP; stdout capture gap (#225) — verify via evaluate_expression.
- Java: compile with javac -g; FQCN accepted as breakpoint "file"; redefine_classes hot-swaps changed classes.
- .NET: scriptPath is the compiled .dll; PDBs must be Portable format.
- C/C++: scriptPath is a compiled executable (build with -gdwarf-4 -O0; MinGW's default DWARF-5 breaks LLDB line breakpoints on Windows) or a lone .c/.cpp file (auto-compiled); attach by PID supported; MSVC PDB support is partial.

## Crash diagnosis
- Launch sessions pause at uncaught exceptions by default with stack + locals live ("none" opts out; "all" also stops on caught raises; Ruby has no uncaught filter so its crashes still terminate). Attach applies no default.
- lastStop.description/text carry the exception class and message; where supported (Python/JS/Java/.NET), lastStop.exceptionInfo adds exceptionId/breakMode/details a moment after the pause. exitCode in list_debug_sessions distinguishes a crash (non-zero) from a clean exit.

The full skill (with per-language reference files) lives in skills/debugging/ of the mcp-debugger repo.`;
}

export const DEBUGGING_WORKFLOW_PROMPT = buildDebuggingWorkflowPrompt();
