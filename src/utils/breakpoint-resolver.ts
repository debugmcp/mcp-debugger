/**
 * Pure content-addressing helpers for set_breakpoint (issue #271).
 *
 * All functions operate on a file's lines (1-based line numbers) and return
 * result unions with fully formatted, agent-facing error messages. File I/O
 * stays in the callers (server layer / session layer).
 */

const CONTEXT_LINES = 2;
const MAX_LISTED_MATCHES = 20;

export type LineContentAssertion =
  | { ok: true }
  | { ok: false; actual: string | null; message: string };

export interface AssertLineContentOptions {
  /** Append the statement-addressing hint (content mode only). */
  statementHint?: boolean;
}

/**
 * Render a small window of numbered context lines around `line`, marking the
 * target line with '>'.
 */
function formatContext(lines: string[], line: number): string {
  const start = Math.max(1, line - CONTEXT_LINES);
  const end = Math.min(lines.length, line + CONTEXT_LINES);
  const width = String(end).length;
  const rendered: string[] = [];
  for (let n = start; n <= end; n++) {
    const marker = n === line ? '>' : ' ';
    rendered.push(`${marker} ${String(n).padStart(width)} | ${lines[n - 1]}`);
  }
  return rendered.join('\n');
}

/**
 * Check that the trimmed content of `line` equals the trimmed expectation.
 * On mismatch the message shows expected vs actual plus surrounding context so
 * the agent can pick the correct line without another read.
 */
export function assertLineContent(
  lines: string[],
  line: number,
  expectedContent: string,
  filePath: string,
  options?: AssertLineContentOptions
): LineContentAssertion {
  if (line < 1 || line > lines.length) {
    return {
      ok: false,
      actual: null,
      message:
        `Breakpoint not set: line ${line} of ${filePath} does not exist (file has ${lines.length} lines). ` +
        `Re-read the file and pick a valid line.`,
    };
  }

  const expected = expectedContent.trim();
  const actual = lines[line - 1].trim();
  if (actual === expected) {
    return { ok: true };
  }

  let message =
    `Breakpoint not set: line ${line} of ${filePath} does not match expectedContent.\n` +
    `Expected: "${expected}"\n` +
    `Actual:   "${actual}"\n` +
    `Context:\n${formatContext(lines, line)}\n` +
    `The file may have changed since you last read it. Pick the correct line from the context above.`;
  if (options?.statementHint) {
    message += ` Or address by content: set_breakpoint {statement: "${expected}"}.`;
  }
  return { ok: false, actual, message };
}

/**
 * Whether a statement anchor is a blank line or a comment-only line under a
 * language-agnostic prefix heuristic (#, //, /*). Deliberately does NOT treat
 * bare '*' as a comment: Rust deref assignments ('*guard = 5;') are
 * legitimate anchors, and a missed block-comment interior falls through to
 * adapter verification + loud snapping — the safe failure mode. '#' also
 * rejects Rust attributes ('#[derive]'), which are non-executable anyway.
 */
export function isCommentOrBlank(statement: string): boolean {
  const trimmed = statement.trim();
  return (
    trimmed === '' ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/*')
  );
}

export type StatementResolution =
  | { ok: true; line: number }
  | { ok: false; message: string };

/**
 * Resolve a statement anchor to a line number by whole-line trimmed-equality
 * match. Ambiguity is an error whose message lists every match (the error IS
 * the disambiguation UI); `nearLine` selects the closest match instead, ties
 * broken toward the lower line number.
 */
export function resolveStatement(
  lines: string[],
  statement: string,
  filePath: string,
  nearLine?: number
): StatementResolution {
  if (statement.includes('\n')) {
    return {
      ok: false,
      message:
        'Invalid statement anchor: statement must be a single line. Anchor on the first line of a multi-line construct.',
    };
  }
  if (isCommentOrBlank(statement)) {
    return {
      ok: false,
      message:
        `Invalid statement anchor: "${statement.trim()}" is a comment or blank line. ` +
        `Debuggers cannot break there reliably — anchor on an executable statement (assignment, call, return, condition).`,
    };
  }

  const target = statement.trim();
  const matches: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === target) {
      matches.push(i + 1);
    }
  }

  if (matches.length === 0) {
    return {
      ok: false,
      message:
        `Breakpoint not set: statement "${target}" not found in ${filePath}.\n` +
        `Statements match a whole line's content after trimming leading/trailing whitespace — check for typos or partial-line text.`,
    };
  }

  if (matches.length === 1) {
    return { ok: true, line: matches[0] };
  }

  if (nearLine !== undefined) {
    let best = matches[0];
    for (const line of matches) {
      const distance = Math.abs(line - nearLine);
      const bestDistance = Math.abs(best - nearLine);
      if (distance < bestDistance) {
        best = line;
      }
      // Ties keep the earlier (lower) line: matches is ascending.
    }
    return { ok: true, line: best };
  }

  const listed = matches
    .slice(0, MAX_LISTED_MATCHES)
    .map((line) => `  ${line}: ${lines[line - 1].trim()}`)
    .join('\n');
  const overflow =
    matches.length > MAX_LISTED_MATCHES
      ? `\n  ... and ${matches.length - MAX_LISTED_MATCHES} more`
      : '';
  return {
    ok: false,
    message:
      `Breakpoint not set: statement "${target}" matches ${matches.length} lines in ${filePath}:\n` +
      `${listed}${overflow}\n` +
      `Add nearLine to pick the closest match (e.g. nearLine: ${matches[0]}).`,
  };
}
