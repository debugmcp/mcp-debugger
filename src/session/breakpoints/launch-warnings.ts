/**
 * Launch-time breakpoint warnings.
 *
 * Each of these reads session state and returns text (or, for the
 * run-to-completion summary, text plus the structured fields behind it) — no
 * adapter, no proxy, no clock. They were already written that way as methods
 * (their tests called them off the prototype with a bare receiver to prove
 * it); as free functions the purity is the signature rather than a convention.
 */
import {
  getPolicyForLanguage,
  type AdapterPolicy,
  type ExceptionBreakMode,
  type ProgramOutputContract
} from '@debugmcp/shared';
import { normalizeBreakpointMessage } from '../../utils/breakpoint-message.js';
import type { BufferedOutputEntry, OutputRingBuffer } from '../output-buffer.js';
import type { ManagedSession } from '../session-store.js';

const DEFAULT_ATTACH_CHILD_DEBUGGING_NOTE = "on an attach, processes the target starts afterwards are not debugged unless requested, so a breakpoint in code only such a process runs is never hit; adapterConfig: { autoAttachChildProcesses: true } on the attach requests it for a target reached through a local endpoint, but it changes the target: each process it starts from then on is made to load a file from this server (through NODE_OPTIONS) and to wait at startup for the debugger, so it can fail to start if the target cannot load this server's file, starts late when the target forks fast, and can be left waiting if it is forked during a detach (#1286)";

export const OUTPUT_TAIL_LINES = 8;
export const OUTPUT_TAIL_LINE_CHARS = 300;
export const OUTPUT_TAIL_STDERR_HEAD_LINES = 4;
export const OUTPUT_TAIL_STDERR_TAIL_LINES = OUTPUT_TAIL_LINES - OUTPUT_TAIL_STDERR_HEAD_LINES - 1;

export function formatOutputTailGapMarker(omittedLines: number): string {
  return `... (${omittedLines} lines omitted)`;
}

interface CategoryRun {
  category: string;
  categoryOmitted: boolean;
  text: string;
  closedByTruncation: boolean;
}

interface ProgramLine {
  category: 'stdout' | 'stderr' | 'console';
  text: string;
}

/**
 * Join consecutive buffer entries of the same category (and same explicit vs
 * omitted category origin) before splitting on `\n` (issues #1036, #1277):
 * - consecutive stream chunks (including `\r` and `\n` split across two chunks
 *   on a pty) join into one line;
 * - an entry of another category between two chunks (such as Delve's `console`
 *   line between its newline-less `Building <pkg>` `stdout` chunk and the Go
 *   program's first `stdout` line) keeps the two runs separate;
 * - an entry the ring buffer cut at 8,192 characters (`truncated: true`) ends
 *   its run so the next chunk is never glued onto it.
 */
function joinConsecutiveRuns(
  entries: readonly Pick<BufferedOutputEntry, 'category' | 'output' | 'truncated' | 'categoryOmitted'>[]
): CategoryRun[] {
  const runs: CategoryRun[] = [];
  for (const entry of entries) {
    const omitted = entry.categoryOmitted === true;
    const truncated = entry.truncated === true;
    const last = runs[runs.length - 1];
    if (last && !last.closedByTruncation && last.category === entry.category && last.categoryOmitted === omitted) {
      last.text += entry.output;
      last.closedByTruncation = truncated;
    } else {
      runs.push({
        category: entry.category,
        categoryOmitted: omitted,
        text: entry.output,
        closedByTruncation: truncated
      });
    }
  }
  return runs;
}

function splitTrimmedNonEmptyLines(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

function boundOutputTailLine(line: string): string {
  return line.length > OUTPUT_TAIL_LINE_CHARS ? `${line.slice(0, OUTPUT_TAIL_LINE_CHARS)}…` : line;
}

function safePredicate(fn: () => boolean): boolean {
  try {
    return fn();
  } catch {
    return false;
  }
}

function findTrailingLongStderrBlockStart(lines: readonly ProgramLine[]): number | undefined {
  let start = lines.length;
  while (start > 0 && lines[start - 1].category === 'stderr') {
    start--;
  }
  return lines.length - start > OUTPUT_TAIL_LINES ? start : undefined;
}

function findLastFatalErrorIndex(
  lines: readonly ProgramLine[],
  isFatalErrorLine: ProgramOutputContract['isFatalErrorLine']
): number {
  if (!isFatalErrorLine) {
    return -1;
  }
  for (let i = lines.length - 1; i >= 0; i--) {
    if (safePredicate(() => isFatalErrorLine(lines[i].text))) {
      return i;
    }
  }
  return -1;
}

/**
 * The last non-empty lines captured on `buffer` across all categories, for a
 * failed launch's adapter-output quote (issue #1036): consecutive chunks of
 * the same category joined (ending after a truncated chunk), trimmed, up to 8
 * lines of 300 characters each. Undefined when nothing was captured.
 */
export function readOutputTailLines(
  buffer: Pick<OutputRingBuffer, 'readBuffered'> | undefined
): string[] | undefined {
  const lines = joinConsecutiveRuns(buffer?.readBuffered() ?? [])
    .flatMap(run => splitTrimmedNonEmptyLines(run.text))
    .slice(-OUTPUT_TAIL_LINES)
    .map(boundOutputTailLine);
  return lines.length > 0 ? lines : undefined;
}

/**
 * The tail is the last 8 non-empty lines of the program's own output (up to 300
 * characters plus `"…"` each) in arrival order across streams — except when the
 * runtime does not put its cause last (`causeLast !== true`) and either the
 * last policy-recognised runtime fatal-error line sits above the last 8 or
 * (with no fatal-error line recognised) all 8 fall inside one `stderr` block
 * longer than 8 lines, in which case it quotes that head line and the 3 after
 * it, `"... (N lines omitted)"`, and the last 3 lines (issues #1254, #1136,
 * #1277). Reads only `session`'s own buffer and never walks the session tree;
 * undefined when `exitCode` is 0, unreported, or no program output was captured.
 */
export function exitOutputTail(
  session: Pick<ManagedSession, 'exitCode'> & Partial<Pick<ManagedSession, 'outputBuffer' | 'language'>>
): string[] | undefined {
  if (typeof session.exitCode !== 'number' || session.exitCode === 0) {
    return undefined;
  }
  const contract = session.language ? getPolicyForLanguage(session.language).programOutput : undefined;
  const runs = joinConsecutiveRuns(session.outputBuffer?.readBuffered() ?? []);
  const programLines: ProgramLine[] = [];

  for (const run of runs) {
    if (run.category === 'stdout' || run.category === 'stderr') {
      const category = run.category;
      for (const line of splitTrimmedNonEmptyLines(run.text)) {
        if (!safePredicate(() => contract?.isAdapterLine?.(category, line) === true)) {
          programLines.push({ category, text: line });
        }
      }
    } else if (run.category === 'console' && contract?.explicitConsoleIsProgram === true && !run.categoryOmitted) {
      for (const line of splitTrimmedNonEmptyLines(run.text)) {
        programLines.push({ category: 'console', text: line });
      }
    }
  }

  if (programLines.length === 0) {
    return undefined;
  }

  let quoteStart: number | undefined;
  if (contract?.causeLast !== true) {
    const fatalIdx = findLastFatalErrorIndex(programLines, contract?.isFatalErrorLine);
    if (fatalIdx >= 0) {
      quoteStart = fatalIdx < programLines.length - OUTPUT_TAIL_LINES ? fatalIdx : undefined;
    } else {
      quoteStart = findTrailingLongStderrBlockStart(programLines);
    }
  }

  if (quoteStart !== undefined) {
    const omitted = programLines.length - quoteStart - (OUTPUT_TAIL_STDERR_HEAD_LINES + OUTPUT_TAIL_STDERR_TAIL_LINES);
    return [
      ...programLines.slice(quoteStart, quoteStart + OUTPUT_TAIL_STDERR_HEAD_LINES).map(line => boundOutputTailLine(line.text)),
      formatOutputTailGapMarker(omitted),
      ...programLines.slice(-OUTPUT_TAIL_STDERR_TAIL_LINES).map(line => boundOutputTailLine(line.text))
    ];
  }

  return programLines.slice(-OUTPUT_TAIL_LINES).map(line => boundOutputTailLine(line.text));
}

/** Appends a short `get_output` pointer clause when an end answer carries `outputTail` (issue #1254). */
export function withOutputTailClause(message: string, outputTail: readonly string[] | undefined): string {
  if (!outputTail || outputTail.length === 0) {
    return message;
  }
  return `${message}${/[.!?]$/.test(message) ? '' : '.'} See outputTail (get_output has the full output).`;
}

/**
 * The file's last path segment, whichever separator the record's path uses —
 * a client's Windows path reaches a Linux host verbatim, and `path.basename`
 * there would echo the whole thing. The one spelling of a file in every
 * breakpoint sentence (launch/attach warnings, the resync report).
 */
export function fileLabel(file: string): string {
  return file.split(/[\\/]/).pop() || file;
}

/** One line breakpoint the program ran past without stopping (issue #701). */
export interface UnhitBreakpointSummary {
  file: string;
  /** The line as the adapter bound it (the store's current line). */
  line: number;
  /** The line the caller asked for, when the adapter moved it. */
  requestedLine?: number;
  verified: boolean;
}

/**
 * Whether a breakpoint bound anywhere in this run's session tree (issue #1150):
 * either on `session` itself, or recorded in `session.run.treeVerifiedBreakpointIds`
 * when an adopted child verified or hit its copy.
 */
function isVerifiedInTree(
  session: Partial<Pick<ManagedSession, 'run'>>,
  bp: { id: string; verified: boolean }
): boolean {
  return bp.verified || session.run?.treeVerifiedBreakpointIds?.has(bp.id) === true;
}

/**
 * Ran-to-completion unbound-breakpoint warning (issue #467). Built only
 * when the launch ends in STOPPED: at that point an unverified breakpoint
 * never bound and never will, for bind-late adapters too — so this is a
 * zero-false-positive moment to surface the per-breakpoint diagnostics the
 * store already holds (e.g. the path-remap suggestion CodeLLDB puts in
 * `message`).
 *
 * Tree-aware (issue #1150): breakpoints verified in an adopted child session
 * bound during this run and are never reported as unbound; when child
 * processes ran undebugged (released, unconfirmed, or opted out), the tail
 * explains that child-only code could not bind instead of blaming only the
 * file path and line.
 */
export function buildUnboundBreakpointExitWarning(
  session: Pick<ManagedSession, 'breakpoints'> &
    Partial<Pick<ManagedSession, 'run' | 'releasedChildReports' | 'unconfirmedChildReleases'>>
): string | undefined {
  const unbound = Array.from(session.breakpoints.values()).filter(bp => !isVerifiedInTree(session, bp));
  if (unbound.length === 0) {
    return undefined;
  }
  const parts = unbound.map(bp => {
    // Some stamp paths store the raw js-debug l10n key — translate it
    // rather than showing 'breakpoint.provisionalBreakpoint' (issue #471).
    const message = normalizeBreakpointMessage(bp.message, bp.verified);
    return `${fileLabel(bp.file)}:${bp.line}${message ? ` (${message})` : ''}`;
  });
  const optedOut = session.run?.childDebuggingOptedOut;
  const released = session.releasedChildReports ?? 0;
  const unconfirmed = session.unconfirmedChildReleases ?? 0;
  if (optedOut !== undefined || released > 0 || unconfirmed > 0) {
    const childClause = optedOut !== undefined
      ? optedOut === 'adapter-default'
        ? DEFAULT_ATTACH_CHILD_DEBUGGING_NOTE
        : `child-process debugging was off (${optedOut}), so breakpoints in code only a child process loads could not bind`
      : released > 0
        ? `${released} child process${released === 1 ? ' ran' : 'es ran'} undebugged, so breakpoints in code only ${released === 1 ? 'it loads' : 'they load'} could not bind`
        : `${unconfirmed} child process${unconfirmed === 1 ? ' could' : 'es could'} not be adopted, so breakpoints in code only ${unconfirmed === 1 ? 'it loads' : 'they load'} could not bind`;
    return (
      `${unbound.length} breakpoint(s) never bound in the debugged process during this run: ${parts.join('; ')}. ` +
      `The program ran to completion without stopping there — ${childClause}; ` +
      `otherwise check the file path and line, or list_breakpoints for the full per-breakpoint state`
    );
  }
  return (
    `${unbound.length} breakpoint(s) never bound during this run: ${parts.join('; ')}. ` +
    `The program ran to completion without stopping there — check the file path and line, ` +
    `or list_breakpoints for the full per-breakpoint state`
  );
}

/**
 * noDebug launch warning (issue #710). `noDebug: true` is DAP's "launch
 * without enabling debugging". Where the adapter honours it (the policy's
 * `honoursNoDebug`, measured per adapter), no breakpoint binds, no exception
 * filter arms, no entry stop lands, and no `stopped` ever arrives. That is a
 * legitimate way to just run the program, so the warning fires only when the
 * caller also asked for a stop — line or function breakpoints in the store,
 * an *explicit* breakOnExceptions other than 'none' (the caller's value, not
 * the policy default the launcher fills in afterwards, which would make every
 * bare noDebug run warn), or stopOnEntry — and names each thing that will not
 * fire. The breakpoint-shaped launch warnings (#308, #467, #469) presuppose a
 * debugger and are withheld by the launcher in that case.
 *
 * Where the adapter ignores the flag, the debugger stays on and the caller is
 * told so instead — the flag they set changes nothing, which is worth a line.
 *
 * `noDebug` and `stopOnEntry` are the flags the adapter will actually see
 * (adapterLaunchConfig over dapLaunchArgs, the launcher's merge order); the
 * text names the flag alone since either source may have carried it.
 */
export function buildNoDebugLaunchWarning(
  session: Pick<ManagedSession, 'breakpoints' | 'functionBreakpoints' | 'language'>,
  launchArgs: { noDebug?: boolean; stopOnEntry?: boolean } | undefined,
  explicitBreakOnExceptions: ExceptionBreakMode | undefined,
  honoursNoDebug: boolean
): string | undefined {
  if (launchArgs?.noDebug !== true) {
    return undefined;
  }
  if (!honoursNoDebug) {
    return (
      `noDebug has no effect with the ${session.language} adapter: the debugger stays on, ` +
      `and breakpoints, breakOnExceptions and stopOnEntry work as usual`
    );
  }
  const expected: string[] = [];
  let lineCount = 0;
  let logpointCount = 0;
  for (const bp of session.breakpoints.values()) {
    if (bp.logMessage !== undefined) {
      logpointCount++;
    } else {
      lineCount++;
    }
  }
  const functionCount = session.functionBreakpoints?.size ?? 0;
  if (lineCount > 0) {
    expected.push(`${lineCount} breakpoint(s)`);
  }
  if (logpointCount > 0) {
    expected.push(`${logpointCount} logpoint(s)`);
  }
  if (functionCount > 0) {
    expected.push(`${functionCount} function breakpoint(s)`);
  }
  if (explicitBreakOnExceptions !== undefined && explicitBreakOnExceptions !== 'none') {
    expected.push(`breakOnExceptions='${explicitBreakOnExceptions}'`);
  }
  if (launchArgs.stopOnEntry === true) {
    expected.push('stopOnEntry');
  }
  if (expected.length === 0) {
    return undefined;
  }
  const list =
    expected.length === 1
      ? expected[0]
      : `${expected.slice(0, -1).join(', ')} and ${expected[expected.length - 1]}`;
  // What is known: the flag, and what it keeps from firing. Not "no stop
  // can arrive" — js-debug lands a user pause under the flag (issue #749).
  return (
    `noDebug is true, so the debugger is off for this launch: ` +
    `${list} will not fire. Drop noDebug to debug, or ignore this if you only meant to run the program`
  );
}

/**
 * The note a launch that failed under an honoured `noDebug` carries when the
 * warning above had nothing to say (nothing was armed). It states the fact
 * without blaming the flag: the failure may be unrelated (a bad path, a
 * missing runtime — the adapter's own error says which), or an adapter
 * behaving differently under the flag — Delve launches the binary through
 * Go's exec, which on Windows wants the .exe extension, so go gets that
 * sentence and no one else does.
 */
export function buildNoDebugFailureNote(language: string): string {
  const quirk =
    language === 'go'
      ? ' (Delve launches the binary through Go\'s exec, which on Windows needs the .exe extension)'
      : '';
  return (
    'noDebug is true, so this launch ran with the debugger disabled. The failure may be unrelated to the flag ' +
    `(see the error), or an adapter behaving differently under it${quirk}; to compare, drop noDebug and launch again`
  );
}

/** What a launch reports when it ended STOPPED: a sentence for the message, and the fields behind it. */
export interface RunToCompletionSummary {
  /** Appended to the launch message after "Current state: stopped". */
  summary: string;
  /** Spread into the result's data. */
  data: {
    exitCode?: number;
    unhitBreakpoints?: UnhitBreakpointSummary[];
    outputTail?: string[];
  };
}

/**
 * How the program ended, by the exit code the debuggee reported — or did not
 * (attach targets, signal-killed debuggees and adapters that send no `exited`
 * leave it undefined). No trailing period: callers continue the sentence.
 */
export function describeProgramEnd(exitCode: number | undefined): string {
  return typeof exitCode !== 'number'
    ? 'The program ended without reporting an exit code'
    : exitCode === 0
      ? 'The program ran to completion (exit code 0)'
      : `The program exited with code ${exitCode}`;
}

/**
 * Run-to-completion summary (issue #701). Built when the launch ends in
 * STOPPED. Says how the program ended — with its exit code when the debuggee
 * reported one (attach targets, signal-killed debuggees and adapters that
 * send no `exited` leave it undefined) — and, when no stop was recorded,
 * lists every breakpoint it ran past, verified or not, naming the verified
 * ones (the unbound warning, #467, names the unbound ones). A stop that was
 * recorded before the exit — a breakpoint hit whose `stopped` and the
 * `exited` arrived in the same tick — means the breakpoints were not all
 * missed, so the list is withheld and the stop is named instead. The same
 * holds for the session's tree (issue #1128): when a child session stopped
 * during the run, the run did not "hit nothing" — the breakpoints are copied
 * to each child, whose stops are its own — so the list is withheld and the
 * tree's stops are counted instead. Logpoints
 * the adapter supports are not breakpoints the program "missed" (they log
 * and run on) and are left out; a downgraded logpoint (no adapter support)
 * did pause, so it counts.
 */
export function buildRunToCompletionSummary(
  session: Pick<ManagedSession, 'breakpoints' | 'functionBreakpoints' | 'exitCode' | 'lastStop' | 'descendantStops' | 'adapterCapabilities' | 'programEndExplanation'> &
    Partial<Pick<ManagedSession, 'run' | 'outputBuffer' | 'language'>>
): RunToCompletionSummary {
  const base = summarizeProgramEnd(session);
  // What the adapter read into the end (issue #877: the devices a Flutter launch found when
  // its deviceId matched none) joins the sentence and the data — under the policy's own
  // keys, the summary's own fields winning, as in wait_for_stop and the session listing.
  const explanation = session.programEndExplanation;
  if (!explanation) {
    return base;
  }
  return {
    summary: explanation.note ? `${base.summary} ${explanation.note}` : base.summary,
    data: { ...(explanation.data ?? {}), ...base.data } as RunToCompletionSummary['data'],
  };
}

function summarizeProgramEnd(
  session: Pick<ManagedSession, 'breakpoints' | 'functionBreakpoints' | 'exitCode' | 'lastStop' | 'descendantStops' | 'adapterCapabilities'> &
    Partial<Pick<ManagedSession, 'run' | 'outputBuffer' | 'language'>>
): RunToCompletionSummary {
  const exitCode = session.exitCode;
  const ended = describeProgramEnd(exitCode);
  const outputTail = exitOutputTail(session);
  const data: RunToCompletionSummary['data'] = {
    ...(typeof exitCode === 'number' ? { exitCode } : {}),
    ...(outputTail ? { outputTail } : {})
  };

  if (session.lastStop) {
    return {
      summary: withOutputTailClause(
        `${ended} after a stop the launch could not report (last stop: ${session.lastStop.reason}).`,
        outputTail
      ),
      data
    };
  }

  // This session never stopped, but its tree did (issue #1128): which of its
  // breakpoints a child stopped on is the child's record, gone with the
  // child's row — so nothing is listed as unhit, and nothing is called "never
  // hit" that a child session stopped on.
  const treeStops = session.descendantStops ?? 0;
  if (treeStops > 0) {
    return {
      summary: withOutputTailClause(
        `${ended}. Its child sessions stopped ${treeStops} time${treeStops === 1 ? '' : 's'} during this run.`,
        outputTail
      ),
      data
    };
  }

  const logpointsRunOn = session.adapterCapabilities?.supportsLogPoints === true;
  const unhitBreakpoints: UnhitBreakpointSummary[] = [];
  for (const bp of session.breakpoints.values()) {
    if (logpointsRunOn && bp.logMessage !== undefined) {
      continue;
    }
    unhitBreakpoints.push({
      file: bp.file,
      line: bp.line,
      ...(typeof bp.requestedLine === 'number' && bp.requestedLine !== bp.line ? { requestedLine: bp.requestedLine } : {}),
      verified: isVerifiedInTree(session, bp)
    });
  }
  const unhitFunctions = Array.from(session.functionBreakpoints?.values() ?? []);
  data.unhitBreakpoints = unhitBreakpoints;

  if (unhitBreakpoints.length === 0 && unhitFunctions.length === 0) {
    return { summary: withOutputTailClause(`${ended}.`, outputTail), data };
  }
  const verifiedNames = [
    ...unhitBreakpoints.filter(bp => bp.verified).map(bp => `${fileLabel(bp.file)}:${bp.line}`),
    ...unhitFunctions.filter(bp => isVerifiedInTree(session, bp)).map(bp => `function '${bp.functionName}'`)
  ];
  const optedOut = session.run?.childDebuggingOptedOut;
  const processScope = session.run?.attachMode ? 'the attached process' : 'the launched process';
  const optOutClause = optedOut === 'adapter-default'
    ? ` in ${processScope} (${DEFAULT_ATTACH_CHILD_DEBUGGING_NOTE})`
    : optedOut !== undefined
      ? ` in ${processScope} (child-process debugging was off via ${optedOut}, so any child processes would not be debugged)`
      : '';
  const verifiedClause = verifiedNames.length > 0
    ? ` Verified${optedOut !== undefined ? ` in ${processScope}` : ''} but never hit: ${verifiedNames.join(', ')}.`
    : '';
  return {
    summary: withOutputTailClause(`${ended} without hitting any breakpoint${optOutClause}.${verifiedClause}`, outputTail),
    data
  };
}

/**
 * Launch-time logpoint-downgrade warning (issue #469). A logpoint accepted
 * pre-launch under unknown policy support ("it will be validated against
 * the adapter's capabilities at launch") gets its promised verdict here:
 * when the live adapter does not advertise supportsLogPoints, the logpoint
 * has been silently downgraded to a pausing breakpoint — say so in the
 * start_debugging response instead of only in the server log.
 */
export function buildLogpointDowngradeLaunchWarning(
  session: Pick<ManagedSession, 'breakpoints' | 'adapterCapabilities' | 'language'>
): string | undefined {
  const caps = session.adapterCapabilities;
  if (!caps || caps.supportsLogPoints === true) {
    return undefined;
  }
  const downgraded: string[] = [];
  for (const bp of session.breakpoints.values()) {
    if (bp.logMessage !== undefined) {
      downgraded.push(`${fileLabel(bp.file)}:${bp.line}`);
    }
  }
  if (downgraded.length === 0) {
    return undefined;
  }
  return (
    `Logpoint(s) at ${downgraded.join(', ')} were downgraded to pausing breakpoints: ` +
    `the ${session.language} adapter does not advertise supportsLogPoints, so the ` +
    `logMessage will not be logged and the program will PAUSE at those lines instead ` +
    `of running through them`
  );
}

/**
 * Launch-time unbound-function-breakpoint warning (issue #308). Reads the
 * records as they stand when the launch is answered: freshly re-sent for a
 * launch that paused, and otherwise as the worker's pre-launch send and the
 * adapter's breakpoint events left them (issue #856).
 *
 * Two things can leave a function breakpoint unbound, and they are told
 * apart. A name the adapter could not resolve gets the "check the symbol
 * name" sentence — except under a bind-late policy (js/java), where
 * unverified-at-launch is the designed deferral, not a failure. A request
 * the adapter refused outright (the worker echoes a rejected pre-launch set,
 * stamped as a refusal) is reported as that, in the adapter's words and
 * under every policy: it is not a name problem, and the advice would send
 * the caller looking for a typo.
 *
 * The policy is a parameter because the caller resolves it from the session
 * store, whose lookup throws for an unknown language.
 */
export function buildFunctionBreakpointLaunchWarning(
  session: Pick<ManagedSession, 'functionBreakpoints'>,
  policy: AdapterPolicy | undefined
): string | undefined {
  if ((session.functionBreakpoints?.size ?? 0) === 0) {
    return undefined;
  }
  const bindLate = policy?.functionBreakpointsBindLate === true;
  /** The names each distinct refusal was given for, in store order. */
  const refused = new Map<string, string[]>();
  const unresolved: string[] = [];
  for (const bp of session.functionBreakpoints.values()) {
    if (bp.verified) {
      continue;
    }
    if (bp.messageOrigin === 'refusal' && bp.message !== undefined) {
      refused.set(bp.message, [...(refused.get(bp.message) ?? []), `'${bp.functionName}'`]);
      continue;
    }
    if (bindLate) {
      continue;
    }
    const hint = policy?.functionBreakpointNameHint?.(bp.functionName) ?? bp.message;
    unresolved.push(`'${bp.functionName}'${hint ? ` (${hint})` : ''}`);
  }
  const sentences = [...refused].map(
    ([refusal, names]) =>
      `The debugger refused function breakpoint(s) ${names.join(', ')}: ${refusal} — ` +
      `the program will not stop there`
  );
  if (unresolved.length > 0) {
    sentences.push(
      `Function breakpoint(s) not bound at launch: ${unresolved.join('; ')}. ` +
        `The adapter could not resolve the name, so the program will not stop there — ` +
        `check the symbol name; list_breakpoints shows the current state`
    );
  }
  return sentences.length > 0 ? sentences.join('; ') : undefined;
}
