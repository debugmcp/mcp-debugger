/**
 * Up-front validation of Python (debugpy / pydevd) logpoint messages (issue #1334).
 *
 * pydevd (`_pydevd_bundle/pydevd_utils.py`, `_extract_expression_list` and
 * `convert_dap_log_message_to_expression`) scans a DAP `logMessage` character by
 * character: each `{...}` group is extracted by counting nested `{` and `}`
 * (without string-literal awareness and without `{{` / `}}` brace escapes; empty
 * groups are dropped, and unbalanced braces replace the whole message with
 * `'Unbalanced braces in: ...'`), stripped of outer whitespace, and spliced into
 * `repr(fmt) + " % (" + ", ".join(vars) + ",)"`. At hit time `pydevd.py`'s
 * `handle_breakpoint_expression` calls `eval(...)` on that string and catches
 * any exception as `str(exc)`, so a `SyntaxError` is only surfaced when the
 * line runs (`invalid syntax (<string>, line 1)` or
 * `invalid decimal literal (<string>, line 1)`).
 *
 * Callers frequently write f-string field suffixes inside logpoint braces —
 * conversions (`{entry!r}`, `{x!s}`, `{x!a}`) and format specs (`{total:.2f}`).
 * Neither is valid in a Python expression, so every such group is certain to
 * fail when hit. This validator refuses only those top-level forms when the
 * breakpoint is set and names the expression form that works.
 */

const CONVERSION_FN = {
  r: 'repr',
  s: 'str',
  a: 'ascii'
} as const;

type FStringConversion = keyof typeof CONVERSION_FN;

const IDENT_START_RE = /[\p{ID_Start}_]/u;
const IDENT_CONTINUE_RE = /[\p{ID_Continue}]/u;
const STRING_PREFIX_RE = /^(?:[rRuUbBfFtT]|[rR][bBfFtT]|[bBfFtT][rR])$/;
const INTERPOLATED_PREFIX_RE = /[fFtT]/;
const STATEMENT_HEADER_RE = /^(?:if|elif|else|for|while|with|try|except|finally|def|class|match|case)\b/;
const DANGLING_OPERATOR_RE = /[+\-*/%=<>&|^~@]$/;
const TRAILING_KEYWORD_RE =
  /(?:^|[^.\p{ID_Continue}])(?:and|or|not|in|is|if|else|lambda|for|await|return|import|from|raise|del|pass|break|continue|assert|global|nonlocal)$/u;

export interface PythonLogMessageGroup {
  /** Exact substring between the outer `{` and `}`, as written by the caller. */
  raw: string;
  /** Trimmed group text, matching pydevd's `"".join(expression).strip()`. */
  expression: string;
}

/**
 * Extract `{...}` groups using pydevd's exact nested-brace rule
 * (`_extract_variable_nested_braces` / `_extract_expression_list`). Returns
 * `undefined` when braces are unbalanced, matching pydevd's whole-message
 * `SyntaxError` fallback.
 */
export function extractPythonLogMessageGroups(logMessage: string): PythonLogMessageGroup[] | undefined {
  const groups: PythonLogMessageGroup[] = [];
  let i = 0;
  while (i < logMessage.length) {
    if (logMessage[i] !== '{') {
      i += 1;
      continue;
    }
    let level = 0;
    const start = i + 1;
    i += 1;
    while (i < logMessage.length) {
      const ch = logMessage[i];
      if (ch === '{') {
        level += 1;
      } else if (ch === '}') {
        level -= 1;
        if (level === -1) {
          break;
        }
      }
      i += 1;
    }
    if (level !== -1) {
      return undefined;
    }
    const raw = logMessage.slice(start, i);
    const expression = raw.trim();
    if (expression.length > 0) {
      groups.push({ raw, expression });
    }
    i += 1;
  }
  return groups;
}

function isConversionChar(ch: string | undefined): ch is FStringConversion {
  return ch === 'r' || ch === 's' || ch === 'a';
}

function isIdentifierStartAt(src: string, index: number): boolean {
  if (index >= src.length) {
    return false;
  }
  const ch = String.fromCodePoint(src.codePointAt(index)!);
  return IDENT_START_RE.test(ch);
}

function readIdentifierEnd(src: string, start: number): number {
  let i = start;
  while (i < src.length) {
    const ch = String.fromCodePoint(src.codePointAt(i)!);
    if (!IDENT_CONTINUE_RE.test(ch)) {
      break;
    }
    i += ch.length;
  }
  return i;
}

function matchingOpen(closer: ')' | ']' | '}'): '(' | '[' | '{' {
  if (closer === ')') return '(';
  if (closer === ']') return '[';
  return '{';
}

/**
 * Index past the closing quote of a Python string literal starting at
 * `quoteStart`, or `-1` when unterminated. Supports single/double and
 * triple-quoted strings plus PEP 701 nested f-string / t-string fields.
 */
function skipPythonString(src: string, quoteStart: number, hasInterpolation: boolean): number {
  const quoteChar = src[quoteStart];
  const triple = src[quoteStart + 1] === quoteChar && src[quoteStart + 2] === quoteChar;
  let i = quoteStart + (triple ? 3 : 1);
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      // In Python f-strings `\` does not escape `{` or `}`, so `f"\{x}"` still
      // opens a replacement field at `{`.
      if (hasInterpolation && (src[i + 1] === '{' || src[i + 1] === '}')) {
        i += 1;
        continue;
      }
      i += 2;
      if (i > src.length) {
        return -1;
      }
      continue;
    }
    if (!triple && (ch === '\n' || ch === '\r')) {
      return -1;
    }
    if (!triple && ch === quoteChar) {
      return i + 1;
    }
    if (triple && ch === quoteChar && src[i + 1] === quoteChar && src[i + 2] === quoteChar) {
      return i + 3;
    }
    if (hasInterpolation) {
      if (ch === '{') {
        if (src[i + 1] === '{') {
          i += 2;
          continue;
        }
        const fieldEnd = skipInterpolatedField(src, i + 1);
        if (fieldEnd < 0) {
          return -1;
        }
        i = fieldEnd;
        continue;
      }
      if (ch === '}') {
        if (src[i + 1] === '}') {
          i += 2;
          continue;
        }
        return -1;
      }
    }
    i += 1;
  }
  return -1;
}

/**
 * Index past the closing `}` of an f-string / t-string `{...}` replacement
 * field starting right after `{`, or `-1` when malformed.
 */
function skipInterpolatedField(src: string, start: number): number {
  const stack: Array<'(' | '[' | '{'> = [];
  let pendingLambdas = 0;
  let prevWasDot = false;
  let inFormatSpec = false;
  let i = start;

  while (i < src.length) {
    if (inFormatSpec) {
      if (src[i] === '{') {
        const nested = skipInterpolatedField(src, i + 1);
        if (nested < 0) {
          return -1;
        }
        i = nested;
        continue;
      }
      if (src[i] === '}') {
        return i + 1;
      }
      i += 1;
      continue;
    }

    const ch = src[i];
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      i += 1;
      continue;
    }
    if (ch === '#') {
      const nl = src.indexOf('\n', i + 1);
      if (nl < 0) {
        return -1;
      }
      i = nl + 1;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const end = skipPythonString(src, i, false);
      if (end < 0) {
        return -1;
      }
      prevWasDot = false;
      i = end;
      continue;
    }
    if (isIdentifierStartAt(src, i)) {
      const identEnd = readIdentifierEnd(src, i);
      const ident = src.slice(i, identEnd);
      const next = src[identEnd];
      if ((next === "'" || next === '"') && STRING_PREFIX_RE.test(ident)) {
        const end = skipPythonString(src, identEnd, INTERPOLATED_PREFIX_RE.test(ident));
        if (end < 0) {
          return -1;
        }
        prevWasDot = false;
        i = end;
        continue;
      }
      if (stack.length === 0 && ident === 'lambda' && !prevWasDot) {
        pendingLambdas += 1;
      }
      prevWasDot = false;
      i = identEnd;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') {
      stack.push(ch);
      prevWasDot = false;
      i += 1;
      continue;
    }
    if (ch === ')' || ch === ']' || ch === '}') {
      if (ch === '}' && stack.length === 0) {
        return i + 1;
      }
      if (stack.length === 0 || stack[stack.length - 1] !== matchingOpen(ch)) {
        return -1;
      }
      stack.pop();
      prevWasDot = false;
      i += 1;
      continue;
    }
    if (ch === ':') {
      if (src[i + 1] === '=') {
        prevWasDot = false;
        i += 2;
        continue;
      }
      if (stack.length === 0) {
        if (pendingLambdas > 0) {
          pendingLambdas -= 1;
          prevWasDot = false;
          i += 1;
          continue;
        }
        inFormatSpec = true;
        i += 1;
        continue;
      }
      prevWasDot = false;
      i += 1;
      continue;
    }
    if (ch === '.') {
      if (src[i + 1] === '.' && src[i + 2] === '.') {
        prevWasDot = false;
        i += 3;
        continue;
      }
      prevWasDot = true;
      i += 1;
      continue;
    }
    prevWasDot = false;
    i += 1;
  }

  return -1;
}

function isPlausibleOperand(expr: string): boolean {
  if (expr.length === 0) {
    return false;
  }
  if (STATEMENT_HEADER_RE.test(expr)) {
    return false;
  }
  if (DANGLING_OPERATOR_RE.test(expr)) {
    return false;
  }
  if (expr.endsWith('.') && !expr.endsWith('...') && !(expr.length >= 2 && /\d$/.test(expr.slice(0, -1)))) {
    return false;
  }
  if (TRAILING_KEYWORD_RE.test(expr)) {
    return false;
  }
  return true;
}

function wrapForCallArg(expr: string, hasTopLevelComma: boolean): string {
  return hasTopLevelComma ? `(${expr})` : expr;
}

function formatPythonStringLiteral(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
  if (value.includes("'") && !value.includes('"')) {
    return `"${escaped}"`;
  }
  return `'${escaped.replace(/'/g, "\\'")}'`;
}

function formatSpecLiteral(spec: string): string {
  const literal = formatPythonStringLiteral(spec);
  return spec.includes('{') && spec.includes('}') ? `f${literal}` : literal;
}

function inspectPythonGroup(group: PythonLogMessageGroup): string | undefined {
  const src = group.expression;
  const stack: Array<'(' | '[' | '{'> = [];
  let pendingLambdas = 0;
  let prevWasDot = false;
  let firstTopLevelComma = -1;
  let lastTopLevelBang = -1;
  let topLevelBangCount = 0;
  let i = 0;

  while (i < src.length) {
    const ch = src[i];
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      i += 1;
      continue;
    }
    if (ch === '#') {
      const nl = src.indexOf('\n', i + 1);
      if (nl < 0) {
        i = src.length;
        break;
      }
      i = nl + 1;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const end = skipPythonString(src, i, false);
      if (end < 0) {
        return undefined;
      }
      prevWasDot = false;
      i = end;
      continue;
    }
    if (isIdentifierStartAt(src, i)) {
      const identEnd = readIdentifierEnd(src, i);
      const ident = src.slice(i, identEnd);
      const next = src[identEnd];
      if ((next === "'" || next === '"') && STRING_PREFIX_RE.test(ident)) {
        const end = skipPythonString(src, identEnd, INTERPOLATED_PREFIX_RE.test(ident));
        if (end < 0) {
          return undefined;
        }
        prevWasDot = false;
        i = end;
        continue;
      }
      if (stack.length === 0 && ident === 'lambda' && !prevWasDot) {
        pendingLambdas += 1;
      }
      prevWasDot = false;
      i = identEnd;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') {
      stack.push(ch);
      prevWasDot = false;
      i += 1;
      continue;
    }
    if (ch === ')' || ch === ']' || ch === '}') {
      if (stack.length === 0 || stack[stack.length - 1] !== matchingOpen(ch)) {
        return undefined;
      }
      stack.pop();
      prevWasDot = false;
      i += 1;
      continue;
    }
    if (ch === '!') {
      if (src[i + 1] === '=') {
        prevWasDot = false;
        i += 2;
        continue;
      }
      if (stack.length === 0) {
        lastTopLevelBang = i;
        topLevelBangCount += 1;
      }
      prevWasDot = false;
      i += 1;
      continue;
    }
    if (ch === ',' && stack.length === 0) {
      if (firstTopLevelComma === -1) {
        firstTopLevelComma = i;
      }
      prevWasDot = false;
      i += 1;
      continue;
    }
    if (ch === ':') {
      if (src[i + 1] === '=') {
        prevWasDot = false;
        i += 2;
        continue;
      }
      if (stack.length === 0) {
        if (pendingLambdas > 0) {
          pendingLambdas -= 1;
          prevWasDot = false;
          i += 1;
          continue;
        }
        // First top-level non-lambda, non-walrus colon: everything after it is
        // the format spec. Stop expression tokenizing here so format-spec fill
        // characters (`'` in `{x:'<10}`, `#` in `{n:#08x}`) are not read as
        // Python string quotes or comments.
        const colonIndex = i;
        const leftTrimEnd = src.slice(0, colonIndex).trimEnd();
        const spec = src.slice(colonIndex + 1);
        const specLiteral = formatSpecLiteral(spec);

        if (
          topLevelBangCount === 1 &&
          lastTopLevelBang === leftTrimEnd.length - 2 &&
          isConversionChar(leftTrimEnd[leftTrimEnd.length - 1])
        ) {
          const conv = leftTrimEnd[leftTrimEnd.length - 1] as FStringConversion;
          const baseRaw = leftTrimEnd.slice(0, lastTopLevelBang).trim();
          if (!isPlausibleOperand(baseRaw)) {
            return undefined;
          }
          const hasComma = firstTopLevelComma !== -1 && firstTopLevelComma < lastTopLevelBang;
          const converted = `${CONVERSION_FN[conv]}(${wrapForCallArg(baseRaw, hasComma)})`;
          return `{${group.raw}}: debugpy evaluates the text between braces as a Python expression, and !${conv}:${spec} is f-string syntax, not an expression; use {format(${converted}, ${specLiteral})} instead.`;
        }

        if (topLevelBangCount > 0) {
          return undefined;
        }
        const baseRaw = leftTrimEnd.trim();
        if (!isPlausibleOperand(baseRaw)) {
          return undefined;
        }
        const hasComma = firstTopLevelComma !== -1 && firstTopLevelComma < colonIndex;
        const badSuffix = spec.length > 0 ? `:${spec}` : "':'";
        return `{${group.raw}}: debugpy evaluates the text between braces as a Python expression, and ${badSuffix} is f-string syntax, not an expression; use {format(${wrapForCallArg(baseRaw, hasComma)}, ${specLiteral})} instead.`;
      }
      prevWasDot = false;
      i += 1;
      continue;
    }
    if (ch === '.') {
      if (src[i + 1] === '.' && src[i + 2] === '.') {
        prevWasDot = false;
        i += 3;
        continue;
      }
      prevWasDot = true;
      i += 1;
      continue;
    }
    prevWasDot = false;
    i += 1;
  }

  if (stack.length !== 0 || pendingLambdas !== 0) {
    return undefined;
  }

  if (
    topLevelBangCount === 1 &&
    lastTopLevelBang === src.length - 2 &&
    isConversionChar(src[src.length - 1])
  ) {
    const conv = src[src.length - 1] as FStringConversion;
    const baseRaw = src.slice(0, lastTopLevelBang).trim();
    if (!isPlausibleOperand(baseRaw)) {
      return undefined;
    }
    const hasComma = firstTopLevelComma !== -1 && firstTopLevelComma < lastTopLevelBang;
    return `{${group.raw}}: debugpy evaluates the text between braces as a Python expression, and !${conv} is f-string syntax, not an expression; use {${CONVERSION_FN[conv]}(${wrapForCallArg(baseRaw, hasComma)})} instead.`;
  }

  return undefined;
}

/**
 * Return a refusal message naming the working expression form when a `{...}`
 * group in a Python `logMessage` uses a top-level f-string conversion (`!r`,
 * `!s`, `!a`) or format spec (`:spec`), or `undefined` when no group is
 * certain to fail for that reason.
 */
export function validatePythonLogMessage(logMessage: string): string | undefined {
  const groups = extractPythonLogMessageGroups(logMessage);
  if (!groups) {
    return undefined;
  }
  for (const group of groups) {
    const problem = inspectPythonGroup(group);
    if (problem !== undefined) {
      return problem;
    }
  }
  return undefined;
}
