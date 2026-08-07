/**
 * Pure content-addressing helpers for set_breakpoint (issue #271).
 *
 * All functions operate on a file's lines (1-based line numbers) and return
 * result unions with fully formatted, agent-facing error messages. File I/O
 * stays in the callers (server layer / session layer).
 */

const CONTEXT_LINES = 2;

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
