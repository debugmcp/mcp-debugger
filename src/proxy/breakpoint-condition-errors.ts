/**
 * js-debug's breakpoint syntax errors, correlated with the request that
 * produced them (issue #853).
 *
 * When a breakpoint's condition — or the console.log expression js-debug
 * compiles a logMessage into — fails `new Function`, js-debug writes one
 * line to the DAP output stream (category stderr), synchronously inside the
 * setBreakpoints request, and answers that breakpoint as a never-resolving
 * "Unbound breakpoint". The line names the line number and, for a plain
 * condition, the condition text; for a logpoint its `{0}` placeholder stays
 * literal (js-debug formats `JSON.stringify(undefined)`). Nothing else ties
 * the line to a breakpoint, so the proxy watches the client's output while
 * its own setBreakpoints is in flight and stamps a matching line onto the
 * response's breakpoint. The line is still forwarded as output.
 */
import type { DebugProtocol } from '@vscode/debugprotocol';

export interface ConditionSyntaxError {
  /** The DAP line js-debug named (the requested line, not a bound one). */
  line: number;
  /** The condition text when js-debug quoted one; absent for a logpoint. */
  condition?: string;
  /** The text to stamp — js-debug's line, a long condition shortened. */
  text: string;
}

const PREFIX = 'Syntax error setting breakpoint with condition ';
// Greedy head: the LAST " on line N: " is the one js-debug appended, so a
// condition that itself contains the phrase still parses.
const TAIL_RE = /^([\s\S]*) on line (\d+): ([\s\S]*)$/;
const CONDITION_PREVIEW = 60;

/** The js-debug line, or undefined for any other output. */
export function parseConditionSyntaxError(output: string): ConditionSyntaxError | undefined {
  const trimmed = output.replace(/\r?\n$/, '');
  if (!trimmed.startsWith(PREFIX)) {
    return undefined;
  }
  const rest = trimmed.slice(PREFIX.length);
  const tail = TAIL_RE.exec(rest);
  if (!tail) {
    return undefined;
  }
  const line = Number(tail[2]);
  if (!Number.isInteger(line)) {
    return undefined;
  }
  const quoted = tail[1];
  let condition: string | undefined;
  if (quoted.startsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(quoted);
      if (typeof parsed === 'string') {
        condition = parsed;
      }
    } catch {
      condition = undefined;
    }
  }
  const preview = condition !== undefined && condition.length > CONDITION_PREVIEW
    ? JSON.stringify(`${condition.slice(0, CONDITION_PREVIEW)}…`)
    : quoted;
  return {
    line,
    ...(condition !== undefined ? { condition } : {}),
    text: `${PREFIX}${preview} on line ${line}: ${tail[3]}`
  };
}

/**
 * Stamp each error onto the one unverified response breakpoint it names:
 * same requested line, and the same condition text when the line quoted one.
 * A line-only error (a logpoint) needs exactly one candidate. Returns the
 * number of breakpoints stamped.
 */
export function stampConditionSyntaxErrors(
  requested: DebugProtocol.SourceBreakpoint[] | undefined,
  response: { body?: { breakpoints?: DebugProtocol.Breakpoint[] } } | null | undefined,
  errors: ConditionSyntaxError[]
): number {
  const answered = response?.body?.breakpoints;
  if (!requested || !Array.isArray(answered) || errors.length === 0) {
    return 0;
  }
  let stamped = 0;
  for (const error of errors) {
    const candidates = requested
      .map((bp, index) => ({ bp, index }))
      .filter(({ bp, index }) => bp.line === error.line && index < answered.length && answered[index].verified !== true)
      .filter(({ bp }) => error.condition === undefined || bp.condition === error.condition);
    if (candidates.length !== 1) {
      continue;
    }
    answered[candidates[0].index].message = error.text;
    stamped += 1;
  }
  return stamped;
}

interface OutputSource {
  on(event: 'output', listener: (body: unknown) => void): unknown;
  off(event: 'output', listener: (body: unknown) => void): unknown;
}

/**
 * Collect js-debug's syntax-error lines from a client's stderr output until
 * stop() is called; stop() removes the listener and returns what was seen.
 */
export function watchConditionSyntaxErrors(client: OutputSource): { stop(): ConditionSyntaxError[] } {
  const errors: ConditionSyntaxError[] = [];
  const onOutput = (body: unknown): void => {
    const output = body as { category?: string; output?: unknown } | undefined;
    if (output?.category !== 'stderr' || typeof output.output !== 'string') {
      return;
    }
    const parsed = parseConditionSyntaxError(output.output);
    if (parsed) {
      errors.push(parsed);
    }
  };
  client.on('output', onOutput);
  return {
    stop: () => {
      client.off('output', onOutput);
      return errors;
    }
  };
}

/**
 * Run a setBreakpoints send while collecting js-debug's syntax-error lines
 * from the client's stderr output, then stamp them onto the response. The
 * listener is removed however the send ends.
 */
export async function sendSetBreakpointsStamping<T extends { body?: { breakpoints?: DebugProtocol.Breakpoint[] } }>(
  client: OutputSource,
  requested: DebugProtocol.SourceBreakpoint[],
  send: () => Promise<T>
): Promise<T> {
  const watch = watchConditionSyntaxErrors(client);
  try {
    const response = await send();
    stampConditionSyntaxErrors(requested, response, watch.stop());
    return response;
  } finally {
    watch.stop();
  }
}

/**
 * The one stored breakpoint, across every file, that an error names: same
 * line, and the same condition text when the line quoted one. js-debug
 * compiles the breakpoints buffered on a pending-target connection while it
 * answers `attach`, so their errors arrive with no request of ours to stamp;
 * this finds the record for a synthesized breakpoint event instead.
 */
export function matchStoredBreakpoint(
  stored: ReadonlyMap<string, DebugProtocol.SourceBreakpoint[]>,
  error: ConditionSyntaxError
): { path: string; breakpoint: DebugProtocol.SourceBreakpoint } | undefined {
  const matches: Array<{ path: string; breakpoint: DebugProtocol.SourceBreakpoint }> = [];
  for (const [path, breakpoints] of stored) {
    for (const breakpoint of breakpoints) {
      if (breakpoint.line === error.line && (error.condition === undefined || breakpoint.condition === error.condition)) {
        matches.push({ path, breakpoint });
      }
    }
  }
  return matches.length === 1 ? matches[0] : undefined;
}
