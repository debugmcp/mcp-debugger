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

/**
 * The most characters of `instructions` a client is known to show the model
 * (issue #1331). Claude Code puts the first 4,096 characters of a server's
 * instructions in front of the model and drops the rest, and lists the tools
 * by name only until the agent searches for one: measured on 2026-11-28 in
 * the first model request of 20 agent trials against the published 0.27.0.
 * This is another product's limit, not a protocol one; other clients were
 * not measured.
 */
export const SERVER_INSTRUCTIONS_LIMIT = 4096;

/** What the server's settings change in the instructions; each defaults to the shipped default. */
export interface ServerInstructionsOptions {
  /** Secret redaction (issue #237): on unless the server runs with DEBUG_MCP_NO_REDACT=1. */
  redactionEnabled?: boolean;
  /** Least-privilege variable access (issue #237): DEBUG_MCP_VARIABLE_ACCESS. */
  variableAccessMode?: 'open' | 'explicit';
  /** The idle policy's window in words (describeIdleWindow); absent = the policy is off (issue #1025). */
  idleWindow?: string;
  /** The stop snapshot (issue #982): on unless the server runs with DEBUG_MCP_NO_SNAPSHOT=1. */
  snapshotEnabled?: boolean;
  /** Container mode (MCP_CONTAINER=true): paths are relative to the workspace mount, not absolute. */
  containerMode?: boolean;
}

/**
 * The instructions, ordered by what an agent needs before its first call
 * (issue #1331): what the server is; the rules an operator's setting adds,
 * because they change which calls work or what happens to the program; the
 * shortest path for a launch, a failing test and an attach; what a stop
 * answer already carries; waiting; logpoints; how a session ends; and where
 * the rest is. A rule about one tool's details lives in that tool's
 * description (src/server/tool-schemas.ts), which the agent reads when it
 * loads the tool. The whole text must fit in SERVER_INSTRUCTIONS_LIMIT for
 * every option combination (tests/core/unit/server/server-instructions.test.ts),
 * and it is ASCII so that characters, UTF-16 units and bytes agree, whichever
 * a client counts.
 */
export function buildServerInstructions(
  mode: BpAddressingMode = DEFAULT_BP_ADDRESSING,
  opts: ServerInstructionsOptions = {}
): string {
  const redactionEnabled = opts.redactionEnabled ?? true;
  const explicitNames = opts.variableAccessMode === 'explicit';
  const snapshotEnabled = opts.snapshotEnabled ?? true;

  // The rules an operator's setting adds come before the general ones: each
  // changes which calls work or what happens to the program.
  const operatorRules: string[] = [];
  if (opts.idleWindow) {
    // Off by default (MCP_DEBUG_SESSION_IDLE_MS, issue #1025): it ends
    // programs, so the agent must know. The sweep skips the whole process
    // while a client holds a notification stream open (the attended check).
    operatorRules.push(
      `- This server closes a debug session tree that no tool call has named for ${opts.idleWindow} (idle policy, MCP_DEBUG_SESSION_IDLE_MS; not while a client holds a notification stream open): a launched program is ended, an attached one released. A tool call naming any session of the tree restarts the clock and holds the tree while the call runs; list_debug_sessions shows each session's expiresInMs.`
    );
  }
  if (explicitNames) {
    operatorRules.push(
      '- This server runs in least-privilege variable access mode (DEBUG_MCP_VARIABLE_ACCESS=explicit): get_variables and get_local_variables require names: ["..."] (exact and case-sensitive; missing ones are listed in notFound), and stop snapshots carry no locals. evaluate_expression remains available for targeted reads.'
    );
  }
  if (!snapshotEnabled) {
    operatorRules.push(
      '- Stop snapshots are off on this server (DEBUG_MCP_NO_SNAPSHOT): an answer at a stop carries its location but no snapshot of frames and locals; read them with get_stack_trace and get_local_variables.'
    );
  }
  const operatorBlock = operatorRules.length > 0 ? `\n\n${operatorRules.join('\n')}` : '';

  // Host mode refuses a relative path (SimpleFileChecker); container mode
  // resolves every path under the workspace mount (resolvePathForRuntime), so
  // a host's absolute path does not reach the file there.
  const pathRule = opts.containerMode
    ? 'file and scriptPath are relative to the project root; the server resolves them under its workspace mount.'
    : 'file and scriptPath must be ABSOLUTE paths.';
  const testFile = opts.containerMode ? 'the test file' : 'ABSOLUTE test file';
  // Content addressing is named only where the mode serves it (issue #271).
  const breakpointStep = supportsStatementAnchors(mode)
    ? 'set_breakpoint {sessionId, file, line} (or statement: "<text of the line>" in place of line, re-resolved at restart_debugging after an edit)'
    : supportsExpectedContent(mode)
      ? 'set_breakpoint {sessionId, file, line} (add expectedContent: "<text of the line>" to catch a wrong line number)'
      : 'set_breakpoint {sessionId, file, line}';
  const attachPathForms = supportsStatementAnchors(mode)
    ? 'give the paths the target sees, a mapping (see attach_to_process) or a function breakpoint (not Ruby or Dart), which needs no path'
    : 'give the paths the target sees or a mapping (see attach_to_process)';

  // Explicit-names mode withholds the snapshot's locals (stop-snapshot.ts),
  // so the snapshot rule says only what that mode's answers carry.
  // wait_for_stop carries an exception's message in lastStop, not in the
  // snapshot, so the message is the answer's, not the snapshot's.
  const snapshotCarries = explicitNames
    ? 'the top frames; an entry stop carries none. At an exception the answer also carries its message. Read it before calling get_stack_trace; get_scopes -> get_variables with a variablesReference (and names) reads nested values.'
    : `the top frames and the top frame's locals (${redactionEnabled ? 'redacted and capped' : 'capped'}); an entry stop carries none. At an exception the answer also carries its message. A repeated stop in the same frame carries changedVariables (what changed) instead of locals. Read it before calling get_stack_trace or get_local_variables; call those, and get_scopes -> get_variables with a variablesReference, only for more frames, the full list or nested values.`;
  const snapshotRule = snapshotEnabled
    ? `\n\nAn answer that reports a stop (launch, restart, wait_for_stop, pause, attach, steps) carries snapshot: ${snapshotCarries}`
    : '';

  return `mcp-debugger drives real step-through debuggers (Python, JavaScript/TypeScript, Ruby, Rust, Go, Java, .NET, C/C++, COBOL, Dart/Flutter) as MCP tools.${operatorBlock}

Launch: create_debug_session {language} -> ${breakpointStep} -> start_debugging {sessionId, scriptPath}. ${pathRule} start_debugging answers paused when a breakpoint is reached as the program starts, stopped when the program ends first, otherwise running with pending:true; wait_for_stop {sessionId} then blocks until the stop.

Failing test (Python): start_debugging {sessionId, scriptPath: ${testFile}, testRunner: "pytest", testTarget: "test_name"} needs no breakpoint: it pauses at the failing assert (or the raise site of an exception that escapes the test), and a passing test runs to completion (exit code 0).

Attach: create_debug_session {language, host, port} (or processId) attaches in the same call; attach_to_process attaches an existing session. The target is a program started under its debugger (python -m debugpy --listen, rdbg --open, node --inspect, a JVM with JDWP, a Dart VM service at adapterConfig.vmServiceUri) or, for C/C++, COBOL, .NET and a local Node.js process, a processId. Attaching pauses the target unless stopOnEntry is false. Breakpoint paths are resolved on the target's filesystem: ${attachPathForms}; a remote attach takes file and line. list_supported_languages shows each language's attach forms and test runners.${snapshotRule}

Steps, evaluation and variable reads need a paused session; each pause says why it stopped. continue_execution returns at once; wait_for_stop blocks until the session pauses or ends. A launch, restart, step, pause or attach may answer pending:true: nothing was cancelled and breakpoints stay armed, so call wait_for_stop, and again if it answers pending:true. wait_for_stop on a session whose program started child sessions (Python, JavaScript) waits on the whole tree, and its answer's sessionId names the session that stopped: inspect with that id.

A logpoint (set_breakpoint with logMessage: "total={total}") writes values to get_output without pausing; each hit costs time, so keep it out of tight loops. Java, .NET and Ruby refuse logpoints. A launch pauses at an uncaught exception by default (not Ruby, nor C/C++ on Windows); an attach does not.

End every session with close_debug_session, even after a failure: a launched program is ended, an attached one released and left running.

For the full debugging workflow (root-cause discipline, per-language quirks), request the "debugging-workflow" prompt or install the agent skill from skills/debugging/ in the repo.`;
}

export const SERVER_INSTRUCTIONS = buildServerInstructions();

export function buildDebuggingWorkflowPrompt(
  mode: BpAddressingMode = DEFAULT_BP_ADDRESSING
): string {
  const setBreakpointStep = supportsStatementAnchors(mode)
    ? '2. set_breakpoint {sessionId, file: ABSOLUTE path, statement: "<line text or distinctive substring>"} — content addressing beats line numbers (only lands on a line containing your text, weak matches warn; nearLine disambiguates repeats; anchors re-resolve across restart_debugging). Line + expectedContent works too'
    : supportsExpectedContent(mode)
      ? '2. set_breakpoint {sessionId, file: ABSOLUTE path, line} — add expectedContent: "<line text or distinctive substring>" so a stale or off-by-one line number fails fast instead of binding somewhere surprising'
      : '2. set_breakpoint {sessionId, file: ABSOLUTE path, line}';

  return `# Debugging workflow (mcp-debugger)

Prefer the debugger over print-debugging whenever you would need more than one edit-run cycle to see program state.

## Golden path (launch)
1. create_debug_session {language} -> sessionId
${setBreakpointStep}
3. start_debugging {sessionId, scriptPath: ABSOLUTE path} — answers paused when a breakpoint is reached as the program starts; otherwise running with pending:true, and wait_for_stop {sessionId} collects the stop (for a server: send the request first)
4. Read the paused answer's snapshot first: it already carries the exception (type/message), the top frames, and the top frame's locals (redacted, capped — snapshot.truncation says when there is more). Often that is the whole inspection.
5. To go deeper: get_stack_trace {sessionId} for the full stack (use each frame's "id" field; it is adapter-assigned, never assume 0), get_scopes {sessionId, frameId} -> variablesReference per scope, then get_variables {sessionId, scope: variablesReference} or get_local_variables {sessionId} for the full locals
6. evaluate_expression {sessionId, expression}
7. step_over / step_into / step_out / continue_execution, then wait_for_stop {sessionId} to block until the next stop or the exit (continue_execution does not wait). Each landed step's snapshot.changedVariables shows exactly what the executed line changed — no get_local_variables needed between steps
8. get_output {sessionId} — cursor-based; pass the returned nextSince back as since for only-new output
9. close_debug_session {sessionId} — ALWAYS, even after errors

## Root-cause discipline
- State a hypothesis before setting breakpoints.
- Set two breakpoints: last-known-good and first-known-bad; run, inspect, halve the interval (bisection beats line-by-line stepping). Use remove_breakpoint / clear_breakpoints to move the window mid-session, and list_breakpoints to see what is set.
- When you want to watch values without pausing, use a logpoint (set_breakpoint with logMessage "x={x}" -> get_output). Each hit costs time depending on the engine — suits hundreds to low thousands of hits/s, not tight loops (slows the whole function in Python/JS/Dart); Python, JS/TS, Go, Rust, C/C++, COBOL, Dart/Flutter (refused by Java/.NET/Ruby).
- At each pause record what you learned, not just where you are.
- When you find the diverging line, inspect every operand before concluding.
- After fixing, restart_debugging re-runs the same recipe in one call (same config, breakpoints re-applied) to confirm the state changed as predicted.

## Session state rules
- PAUSED is required for stepping, evaluation, and variable reads; RUNNING follows continue_execution.
- pending:true on any answer means the stop has not arrived yet and nothing was cancelled: wait_for_stop blocks until it does.
- Each pause carries a stop reason (breakpoint, step, entry, exception...).
- Variable entries with a variablesReference are containers — expand them with get_variables.
- Breakpoints may verify late (debugpy, JDI defer until load) — not an error.

## Attach / remote
attach_to_process {sessionId, host, port, sourcePaths, adapterConfig}
- Python: target started with "python -m debugpy --listen host:port ..."; map a local checkout onto the debuggee tree with adapterConfig: {pathMappings: [{localRoot, remoteRoot}]}
- Ruby: target started with "rdbg --open --port N ..." (works via kubectl port-forward); localfsMap: "/app:<abs local dir>" maps paths
- JavaScript: host/port of a "node --inspect" target, or processId of a plain local node process (its inspector is opened for you on 9229 and stays open, unauthenticated, after detach and close: #1261; pass port too for an --inspect-port target)
- Java: JVM flag -agentlib:jdwp=transport=dt_socket,server=y,address=*:PORT (breakpoints defer until class load); FQCN as "file" needs no source at all
- C/C++ (and other native): attach by PID — attach_to_process {sessionId, processId, adapterConfig: {program: "<binary path>"}}
- COBOL: attach by PID like C/C++; add adapterConfig: {sources: ["<abs .cob>", …]} (the manifest is regenerated by a translate-only cobc -C) or adapterConfig: {manifestDirs: ["<.debug-mcp/cobol/<platform>-<arch>/<name>/<buildKey> dir of the running build>"]} so the shim finds the symbol manifest, or variables show only the engine's C view
- Dart/Flutter: attach to a running VM service — pass adapterConfig.vmServiceUri or vmServiceInfoFile, not a PID (the SDK adapter is spawned locally and connects to the VM service); a Flutter app on an Android device or emulator takes adapterConfig.deviceId alone with no URI (flutter attach discovers it; the app.debugPort URI of another flutter run is that tool's own DDS and never connects)
Breakpoint paths are sent verbatim and resolved on the TARGET's filesystem (host-side existence checks are skipped). Without a mapping, use debuggee-side paths — get_stack_trace shows them — or address by symbol ({function: "name"}), which needs no paths. adapterConfig keys the adapter cannot forward are named in the response's warning.
detach_from_process leaves the target running.
Kubernetes pods (port-forward vs ephemeral sidecar, copy-paste per-language presets): docs/kubernetes.md and examples/kubernetes/attach-presets.md in the mcp-debugger repo.

## IDE mirror (human inspection)
When a human wants to look around in their IDE, expose_session {sessionId} opens a read-only DAP endpoint (127.0.0.1, token-gated) on the live session — even mid-pause. Relay host/port/token with a VS Code launch.json snippet: {"request": "attach", "debugServer": <port>, "mirrorToken": "<token>", "type": <language's debug type>}. The IDE lands on the paused frame and can walk stacks/variables/evaluate; stepping and breakpoints stay yours. unexpose_session closes it.

## Per-language quirks (one-liners)
- Python: expand the "special variables" container; breakpoints verify after module load. A failing test: testRunner "pytest" (+ testTarget) on the test file pauses at the failing assert with the test frame live — a helper's raise site sits above it in the snapshot, pytest.skip() also pauses (one continue), expected exceptions inside pytest.raises never do on Python 3.12+ and pause once on 3.11 and older; a print before the assert reaches get_output only with pytest's report after the run (args ["-s"] for live prints).
- Python stepping: on Python 3.12+ a step_over or step_out where an exception leaves the function never stops (debugpy #2100) and the answer says so; dapLaunchArgs: {env: {PYDEVD_USE_SYS_MONITORING: "0"}} keeps those steps at 6 to 7 times the cost on call-heavy code.
- JavaScript/TS: internals are filtered from stacks; entry pause auto-continues when stopOnEntry=false.
- Ruby: launch always pauses at load then auto-continues; attach sessions capture no stdout (launch streams it) — verify state via evaluate_expression when attached.
- Rust: scriptPath is the source file (adapter resolves the Cargo project); Windows needs the GNU toolchain.
- Go: Delve native DAP; get_local_variables warns when the binary looks optimized (rebuild with -gcflags="all=-N -l" for full locals). A step_over or step_out past runtime.Goexit (so past a failing t.Fatal) does not stop in the deferred calls (Delve #4472); set a breakpoint in the deferred function.
- Java: compile with javac -g; FQCN accepted as breakpoint "file"; hot_reload {classesDir} hot-swaps changed classes (redefine_classes is its deprecated alias); cwd and env are applied to the launched JVM.
- .NET: scriptPath is the compiled .dll; PDBs must be Portable format.
- C/C++: scriptPath is a compiled executable (build with -gdwarf-4 -O0; MinGW's default DWARF-5 breaks LLDB line breakpoints on Windows) or a lone .c/.cpp file (auto-compiled); attach by PID supported; MSVC PDB support is partial.
- COBOL: scriptPath is a .cob/.cbl source (auto-compiled with GnuCOBOL: cobc -g -fdump=ALL, DWARF-4) or a prebuilt executable; dapLaunchArgs {dialect: "ibm", format: "fixed", copybookDirs: [...], runtimeChecks: true, stdinFile: "<file>"}; breakpoints work in copybooks; variables are COBOL-shaped (WORKING-STORAGE / LOCAL-STORAGE / LINKAGE scopes, COMP-3/COMP/DISPLAY decoded, 88-levels as booleans); evaluate_expression takes data-names with OF/IN, subscripts and (start:len); a libcob runtime error (subscript out of bounds, non-numeric data) pauses as an exception before the abort; step_over moves one COBOL statement (step_over on an out-of-line PERFORM runs the performed range and stops on the statement after it, loops included; step_out inside a performed paragraph returns to the statement after its PERFORM; get_stack_trace lists the active PERFORMs as frames).
- Dart/Flutter: scriptPath is a .dart entrypoint; the runner is auto-detected from pubspec (dart / dart-test / flutter / flutter-test) — a program under test/ or integration_test/ runs under the test runner; dapLaunchArgs {deviceId: "<id>"} selects the Flutter device (flutter run -d <id>); attach takes a VM-service URI, not a PID.

## Crash diagnosis
- Launch sessions pause at uncaught exceptions by default with stack + locals live ("none" opts out; "all" also stops on caught raises; Ruby has no uncaught filter so its crashes still terminate). Attach applies no default.
- The paused answer's snapshot.exception carries the class and message up front (secret-redacted), with snapshot.frames and snapshot.locals beside it — usually all you need before evaluate_expression. lastStop.description/text carry the same (redacted in answers); where supported (Python/JS/Java/.NET), lastStop.exceptionInfo adds exceptionId/breakMode/details a moment after the pause. End answers (start_debugging, restart_debugging, wait_for_stop, step_*) carry exitCode when reported, plus outputTail on a non-zero exit with program output (full output in get_output); list_debug_sessions keeps exitCode.

The full skill (with per-language reference files) lives in skills/debugging/ of the mcp-debugger repo.`;
}

export const DEBUGGING_WORKFLOW_PROMPT = buildDebuggingWorkflowPrompt();
