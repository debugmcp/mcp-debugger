/**
 * Pure content-addressing helpers for set_breakpoint (issue #271).
 *
 * All functions operate on a file's lines (1-based line numbers) and return
 * result unions with fully formatted, agent-facing error messages. File I/O
 * stays in the callers (server layer / session layer).
 */

const CONTEXT_LINES = 2;
const MAX_LISTED_MATCHES = 20;

/**
 * How an expectedContent assertion matched (issue #379): 'exact' is trimmed
 * whole-line equality, and 'comment-stripped-exact' is its exact-equivalent
 * — the expectation is the entire code of the line, the line merely carries
 * a trailing comment (issue #440); neither warrants a warning. The remaining
 * qualities are relaxed matches the caller should surface as a warning — the
 * #367 tolerance deliberately accepts lines the expectation only partially
 * pins down.
 */
export type ContentMatchQuality = 'exact' | 'comment-stripped-exact' | 'substring' | 'comment-stripped';

export type LineContentAssertion =
  | { ok: true; matchQuality: ContentMatchQuality; actual: string }
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
 * Strip a trailing line comment (`//…` or `#…`) from a source line.
 *
 * Deliberately naive — NOT string-literal-aware: a `//` or `#` inside a
 * string ("http://…", "issue #42") is stripped too. That is safe here
 * because stripping only RELAXES matching (an extra strip can at worst
 * fail to widen a match, never create a wrong exact match on its own) and
 * substring matches against the unstripped line are always tried as well.
 */
export function stripTrailingComment(line: string): string {
  const slashes = line.indexOf('//');
  const hash = line.indexOf('#');
  let cut = -1;
  if (slashes !== -1 && hash !== -1) {
    cut = Math.min(slashes, hash);
  } else if (slashes !== -1) {
    cut = slashes;
  } else {
    cut = hash;
  }
  return cut === -1 ? line : line.slice(0, cut);
}

/**
 * Check that `line` contains the expected content. Accepted, in order:
 * exact trimmed-line equality, then exact equality against the
 * comment-stripped actual line (the expectation is the line's entire code,
 * issue #440), then the trimmed expectation as a substring of the actual
 * line, then as a substring of the comment-stripped actual line — so
 * trailing comments and partial-line anchors both work.
 * On mismatch the message shows expected vs actual plus surrounding context
 * so the agent can pick the correct line without another read.
 */
export function assertLineContent(
  lines: string[],
  line: number,
  expectedContent: string,
  filePath: string,
  options?: AssertLineContentOptions
): LineContentAssertion {
  if (expectedContent.trim() === '') {
    return {
      ok: false,
      actual: null,
      message:
        'Breakpoint not set: expectedContent is empty or whitespace-only. ' +
        'Provide a distinctive substring of the target line, or omit expectedContent to skip verification.',
    };
  }

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
  // Exact trimmed match, then comment-stripped-exact (whole code of a
  // commented line, #440), then substring of the actual line. Then retry
  // substring with trailing comments stripped from BOTH sides: stripping
  // only the actual line would be redundant (a stripped prefix is always a
  // substring of the full line) — the strip earns its keep when the
  // EXPECTATION carries a stale trailing comment the file no longer has.
  // Every relaxed pass is labeled so callers can warn (issue #379): the
  // substring clause has no distinctiveness floor, and the naive strip
  // collapses lines that differ only past a '//' or '#' — even inside
  // string literals.
  if (actual === expected) {
    return { ok: true, matchQuality: 'exact', actual };
  }
  // Whole-code match on a line that merely carries a trailing comment
  // (issue #440): exact-equivalent, no warning. The expectation-side guard
  // (strip must be a no-op on the expectation) is load-bearing — without it
  // the naive strip would collapse lines that differ only inside a string
  // literal ("http://a" vs "http://b") into a clean match.
  if (
    stripTrailingComment(expectedContent).trim() === expected &&
    stripTrailingComment(lines[line - 1]).trim() === expected
  ) {
    return { ok: true, matchQuality: 'comment-stripped-exact', actual };
  }
  if (actual.includes(expected)) {
    return { ok: true, matchQuality: 'substring', actual };
  }
  const strippedExpected = stripTrailingComment(expectedContent).trim();
  if (
    strippedExpected !== '' &&
    stripTrailingComment(lines[line - 1]).trim().includes(strippedExpected)
  ) {
    return { ok: true, matchQuality: 'comment-stripped', actual };
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
  | { ok: true; line: number; candidates?: number[] }
  | { ok: false; message: string };

/**
 * Turn a non-empty match list into a resolution: single match resolves,
 * `nearLine` selects the closest match (ties broken toward the lower line
 * number), and otherwise the ambiguity error lists every match (the error
 * IS the disambiguation UI). Shared by the exact and substring passes.
 * A nearLine pick among multiple matches reports the full candidate list
 * (issue #379) so callers can flag the proximity choice instead of passing
 * it off as unambiguous.
 */
function resolveMatches(
  matches: number[],
  lines: string[],
  target: string,
  filePath: string,
  nearLine?: number
): StatementResolution {
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
    return { ok: true, line: best, candidates: matches };
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

/**
 * Resolve a statement anchor to a line number. Pass 1 matches whole-line
 * trimmed equality; exact matches always win. Only when there is no exact
 * match anywhere, pass 2 accepts lines whose comment-stripped trimmed
 * content CONTAINS the anchor (comment-only and blank lines excluded), so
 * a distinctive substring is enough and trailing comments don't break
 * matching. Ambiguity in either pass is an error whose message lists every
 * match (the error IS the disambiguation UI); `nearLine` selects the
 * closest match instead, ties broken toward the lower line number.
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

  // Pass 1: whole-line trimmed equality. Exact matches always win — the
  // substring pass never runs when any exact match exists, so the two match
  // populations are never mixed.
  const exactMatches: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === target) {
      exactMatches.push(i + 1);
    }
  }
  if (exactMatches.length > 0) {
    return resolveMatches(exactMatches, lines, target, filePath, nearLine);
  }

  // Pass 2: substring match against the comment-stripped line, so trailing
  // comments and partial-line anchors still resolve. Comment-only and blank
  // lines are excluded — debuggers cannot break there.
  const substringMatches: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (isCommentOrBlank(lines[i])) {
      continue;
    }
    if (stripTrailingComment(lines[i]).trim().includes(target)) {
      substringMatches.push(i + 1);
    }
  }
  if (substringMatches.length > 0) {
    return resolveMatches(substringMatches, lines, target, filePath, nearLine);
  }

  return {
    ok: false,
    message:
      `Breakpoint not set: statement "${target}" not found in ${filePath}.\n` +
      `Statements match a whole line's content after trimming leading/trailing whitespace, or as a substring of a line (trailing comments ignored) — neither matched; check for typos.`,
  };
}
