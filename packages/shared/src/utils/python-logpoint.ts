/**
 * Up-front validation of Python (debugpy / pydevd) logpoint messages (issue #1334).
 *
 * pydevd (`_pydevd_bundle/pydevd_utils.py`, `convert_dap_log_message_to_expression`)
 * splits a DAP `logMessage` at its `{...}` groups by counting braces, with no
 * string awareness and no `{{` escape (an unbalanced message logs
 * `Unbalanced braces in: ...`), strips each group, and joins them all into one
 * expression, `'<text with %s>' % (g1, g2, ...,)`, which `pydevd.py`
 * `handle_breakpoint_expression` eval()s at every hit, logging `str(exc)` when it
 * fails. A group therefore takes a Python expression, not an f-string field: a
 * conversion (`{x!r}`), a format spec (`{total:.2f}`) or the `=` debug form
 * (`{x=}`) at a group's top level logs `invalid syntax` at every hit.
 *
 * This validator refuses those forms when the breakpoint is set and names the
 * form that works. It refuses nothing that evaluates: because the groups are
 * joined, a group that does not parse on its own (an unterminated string, an
 * open bracket, a lambda without its colon, a comment) may be continued by the
 * next one, so checking stops at the first such group. Left to debugpy: groups
 * a brace inside a string literal splits (pydevd counts that brace), comments,
 * a conversion or spec inside brackets, and `{x:=^10}` (read as a walrus).
 */

const CONVERSION_FN = { r: 'repr', s: 'str', a: 'ascii' } as const;
type Conversion = keyof typeof CONVERSION_FN;

const STRING_PREFIX_RE = /^(?:[rbft]|r[bft]|[bft]r)$/i;
const WORD_CHAR_RE = /\w/;
// An operand the replacement can wrap. `match` and `case` are soft keywords:
// in an expression they are names.
const STATEMENT_HEADER_RE = /^(?:if|elif|else|for|while|with|try|except|finally|def|class)\b/;
const DANGLING_OPERATOR_RE = /[+\-*/%=<>&|^~@]$/;
const TRAILING_KEYWORD_RE =
  /(?:^|[^.\p{ID_Continue}])(?:and|or|not|in|is|if|else|lambda|for|await|return|import|from|raise|del|pass|break|continue|assert|global|nonlocal)$/u;
const NUMBER_TOKEN_RE = /^(?:0[xob][\da-f_]+|\d[\d_]*(?:e[+-]?\d*)?j?)$/i;
// How a dict key or value can begin (a spec such as `.2f` or `>10` cannot).
const EXPRESSION_START_RE = /^(?:[\p{ID_Start}_\d'"([{~+-]|\.\.\.|\.\d)/u;
// A char that forms one token with a following `=` (`==`, `<=`, `:=`, `+=`, ...).
const COMPOUND_BEFORE_EQUALS = '=!<>:+-*/%&|^@~';
const MAX_NAMED_GROUPS = 3;

export interface PythonLogMessageGroup {
  /** Exact substring between the outer `{` and `}`, as written by the caller. */
  raw: string;
  /** Trimmed group text, matching pydevd's `"".join(expression).strip()`. */
  expression: string;
}

/**
 * Extract `{...}` groups with pydevd's nested-brace rule
 * (`_extract_variable_nested_braces` / `_extract_expression_list`). Returns
 * `undefined` when braces are unbalanced, matching pydevd's whole-message
 * fallback; drops empty groups as pydevd does.
 */
export function extractPythonLogMessageGroups(logMessage: string): PythonLogMessageGroup[] | undefined {
  const groups: PythonLogMessageGroup[] = [];
  for (let i = 0; i < logMessage.length; i++) {
    if (logMessage[i] !== '{') continue;
    let level = 0;
    const start = ++i;
    for (; i < logMessage.length; i++) {
      if (logMessage[i] === '{') level++;
      else if (logMessage[i] === '}' && --level === -1) break;
    }
    if (level !== -1) return undefined;
    const raw = logMessage.slice(start, i);
    if (raw.trim()) groups.push({ raw, expression: raw.trim() });
  }
  return groups;
}

/** Index past the string literal whose opening quote is at `quote`, or -1. */
function skipString(s: string, quote: number, interpolated: boolean): number {
  const close = s.startsWith(s[quote].repeat(3), quote) ? s[quote].repeat(3) : s[quote];
  for (let i = quote + close.length; i < s.length;) {
    const c = s[i];
    if (c === '\\') {
      // In an f-string `\{` still opens a field.
      i += interpolated && s[i + 1] === '{' ? 1 : 2;
      continue;
    }
    if (s.startsWith(close, i)) return i + close.length;
    if (interpolated && c === '{') {
      if (s[i + 1] === '{') {
        i += 2;
        continue;
      }
      i = scan(s, i + 1, 'field').end;
      if (i < 0) return -1;
      continue;
    }
    i++;
  }
  return -1;
}

type ScanMode = 'group' | 'field' | 'dict';

interface ScanResult {
  /** -1 when the text does not parse on its own; in a field, the index past its `}`. */
  end: number;
  /** Group mode: the first top-level colon that starts a format spec. */
  colon?: number;
  /** Top-level `!` not part of `!=`. */
  bangs: number[];
  /** Top-level commas (in dict mode, not a lambda's parameter commas). */
  commas: number[];
  /** Dict mode: every top-level colon that is not a lambda's or a walrus. */
  colons: number[];
  /** Dict mode: the first top-level `for`. */
  forAt: number;
}

/**
 * Tokenize Python from `start`. A group scan stops at the first top-level colon
 * that starts a format spec. A field scan (an f-string replacement field) ends
 * past its closing `}`; a top-level colon there starts the spec, literal text
 * with nested fields. A dict scan reads the whole text as a dict display body.
 */
function scan(s: string, start: number, mode: ScanMode): ScanResult {
  const result: ScanResult = { end: -1, bangs: [], commas: [], colons: [], forAt: -1 };
  const stack: string[] = [];
  let lambdas = 0;
  for (let i = start; i < s.length;) {
    const c = s[i];
    if (c === '#') {
      const newline = s.indexOf('\n', i);
      if (newline < 0) return result;
      i = newline + 1;
      continue;
    }
    if (c === "'" || c === '"') {
      i = skipString(s, i, false);
      if (i < 0) return result;
      continue;
    }
    if (WORD_CHAR_RE.test(c)) {
      let j = i;
      while (j < s.length && WORD_CHAR_RE.test(s[j])) j++;
      const word = s.slice(i, j);
      if ((s[j] === "'" || s[j] === '"') && STRING_PREFIX_RE.test(word)) {
        i = skipString(s, j, /[ft]/i.test(word));
        if (i < 0) return result;
        continue;
      }
      if (mode === 'dict' && /\d/.test(c) && !isPythonNumber(s, i, word)) return result;
      if (stack.length === 0 && mode !== 'field') {
        if (word === 'lambda') lambdas++;
        if (word === 'for' && result.forAt < 0) result.forAt = i;
      }
      i = j;
      continue;
    }
    if (c === '(' || c === '[' || c === '{') {
      stack.push(c);
      i++;
      continue;
    }
    if (c === ')' || c === ']' || c === '}') {
      if (stack.length === 0 && mode === 'field' && c === '}') return { ...result, end: i + 1 };
      if (stack.pop() !== '([{'[')]}'.indexOf(c)]) return result;
      i++;
      continue;
    }
    if (c === '!' && s[i + 1] === '=') {
      i += 2;
      continue;
    }
    // A dict body is plain Python: no `!` outside `!=`, every `.` an attribute,
    // part of a number or of `...`.
    if (mode === 'dict' && s.startsWith('...', i)) {
      i += 3;
      continue;
    }
    if (mode === 'dict' && (c === '!' || (c === '.' && !isPythonDot(s, i)))) return result;
    if (stack.length === 0) {
      if (c === '!') result.bangs.push(i);
      if (c === ',' && (mode !== 'dict' || lambdas === 0)) result.commas.push(i);
      if (c === ':') {
        if (mode !== 'field' && s[i + 1] === '=') {
          // A walrus: fine in a group, not unparenthesized in a dict key or value.
          if (mode === 'dict') return result;
          i += 2;
          continue;
        }
        if (lambdas > 0) {
          lambdas--;
        } else if (mode === 'group') {
          return { ...result, end: s.length, colon: i };
        } else if (mode === 'dict') {
          result.colons.push(i);
        } else {
          // A spec that runs to the end leaves `end` at the text's length, which
          // every caller reads as an unterminated string.
          for (i++; i < s.length;) {
            if (s[i] === '}') return { ...result, end: i + 1 };
            if (s[i] === '{') {
              i = scan(s, i + 1, 'field').end;
              if (i < 0) return result;
              continue;
            }
            i++;
          }
        }
      }
    }
    i++;
  }
  if (stack.length > 0 || lambdas > 0) return result;
  return { ...result, end: s.length };
}

/** True when `word`, at `start`, is a Python number token (`.` splits a float into two). */
function isPythonNumber(s: string, start: number, word: string): boolean {
  if (!NUMBER_TOKEN_RE.test(word)) return false;
  // `08` is no integer, though `08.5`, `08e1` and `.08` are numbers.
  return !(/^0[\d_]*[1-9][\d_]*$/.test(word) && s[start - 1] !== '.' && s[start + word.length] !== '.');
}

/** True when the `.` at `i` is the point of a number or an attribute access. */
function isPythonDot(s: string, i: number): boolean {
  const left = s.slice(0, i);
  const right = s.slice(i + 1);
  // Right after a decimal integer it is the number's point: `1.5`, `1.`, `1.e3`, `1.j`, not `1.real`.
  if (/(?:^|[^\w.])\d[\d_]*$/.test(left)) return !/^[\p{ID_Start}_]/u.test(right) || /^[ej]/i.test(right);
  // After an operand (`1.5`, `2j`, `1.` included) it is an attribute: a name follows (`x . y`, `1 .real`).
  if (/(?:[\w)\]}'"]|\d\.)\s*$/.test(left)) return /^\s*[\p{ID_Start}_]/u.test(right);
  // Elsewhere only a number can start with it: `.5`.
  return /^\d/.test(right);
}

function isPlausibleOperand(expr: string): boolean {
  return (
    expr.length > 0 &&
    !STATEMENT_HEADER_RE.test(expr) &&
    !DANGLING_OPERATOR_RE.test(expr) &&
    !TRAILING_KEYWORD_RE.test(expr) &&
    !(expr.endsWith('.') && !expr.endsWith('...') && !/\d\.$/.test(expr))
  );
}

/** A Python string literal for `value`. */
function pythonString(value: string): string {
  const escaped = value.replace(/\\/g, '\\\\').replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
  return value.includes("'") && !value.includes('"') ? `"${escaped}"` : `'${escaped.replace(/'/g, "\\'")}'`;
}

/** The spec as a Python literal: an f-string when it holds nested fields. */
function specLiteral(spec: string): string {
  const literal = pythonString(spec);
  return spec.includes('{') && spec.includes('}') ? `f${literal}` : literal;
}

/** True when `expr` is one string literal, any prefix. */
function isStringLiteral(expr: string): boolean {
  const prefix = /^[a-zA-Z]{0,2}(?=['"])/.exec(expr)?.[0];
  return prefix !== undefined && skipString(expr, prefix.length, /[ft]/i.test(prefix)) === expr.length;
}

/** The dict scan of `s` when it reads as the body of a dict display (`k: v, ...`, `**m`, `k: v for ...`). */
function dictBody(s: string): ScanResult | undefined {
  const r = scan(s, 0, 'dict');
  if (r.end < 0) return undefined;
  const operand = (text: string): boolean => EXPRESSION_START_RE.test(text) && isPlausibleOperand(text);
  const pair = (from: number, to: number): boolean => {
    const colons = r.colons.filter((c) => c > from && c < to);
    if (colons.length === 0) return s.slice(from + 1, to).trim().startsWith('**');
    return (
      colons.length === 1 &&
      operand(s.slice(from + 1, colons[0]).trim()) &&
      operand(s.slice(colons[0] + 1, to).trim())
    );
  };
  if (r.forAt >= 0) return !r.commas.some((c) => c < r.forAt) && pair(-1, r.forAt) ? r : undefined;
  const bounds = [-1, ...r.commas, s.length];
  if (s.slice(bounds[bounds.length - 2] + 1).trim() === '') bounds.pop();
  return bounds.slice(1).every((to, k) => pair(bounds[k], to)) ? r : undefined;
}

function sentence(raw: string, bad: string, use: string): string {
  return `{${raw}}: debugpy evaluates the text between braces as a Python expression, and ${bad} is f-string syntax, not an expression; use ${use} instead.`;
}

interface GroupVerdict {
  /** The group does not parse on its own: the next group may continue it. */
  open: boolean;
  problem?: string;
}

function inspectGroup({ raw, expression: s }: PythonLogMessageGroup): GroupVerdict {
  const r = scan(s, 0, 'group');
  if (r.end < 0) return { open: true };
  const hasSpec = r.colon !== undefined;
  const spec = hasSpec ? s.slice(r.colon! + 1) : '';
  let head = (hasSpec ? s.slice(0, r.colon) : s).trimEnd();

  let conv: Conversion | undefined;
  if (r.bangs.length > 0) {
    const bang = r.bangs[0];
    const ch = head[head.length - 1];
    if (bang !== head.length - 2 || !(ch === 'r' || ch === 's' || ch === 'a')) return { open: false };
    conv = ch;
    head = head.slice(0, bang).trimEnd();
  }
  // The `=` debug form: a lone `=` ends the expression.
  const debug = head.endsWith('=') && !COMPOUND_BEFORE_EQUALS.includes(head[head.length - 2]);
  if (!conv && !hasSpec && !debug) return { open: false };
  const base = (debug ? head.slice(0, -1) : head).trim();
  // The replacement wraps the operand: it must parse alone (trimming can strip the
  // newline that ended a comment).
  if (!isPlausibleOperand(base) || scan(base, 0, 'group').end < 0) return { open: false };

  const operand = r.commas.length > 0 ? `(${base})` : base;
  const value = conv ? `${CONVERSION_FN[conv]}(${operand})` : debug && !hasSpec ? `repr(${operand})` : operand;
  const call = hasSpec ? `format(${value}, ${specLiteral(spec)})` : value;
  const suffix = `${conv ? `!${conv}` : ''}${hasSpec ? `:${spec}` : ''}`;

  if (debug) {
    // The caller's own text through `=` and the spaces after it, as the f-string shows it.
    const lead = raw.length - raw.trimStart().length;
    let textEnd = lead + head.length;
    while (/\s/.test(raw[textEnd] ?? '')) textEnd++;
    const text = raw.slice(0, textEnd);
    const shown = /[{}%]/.test(text) ? `{${pythonString(text)}}` : text;
    return { open: false, problem: sentence(raw, `=${suffix}`, `${shown}{${call}}`) };
  }
  // A group that also reads as a dict (a conversion never does): told apart by how
  // each is written. A quoted key or several pairs is a dict; a spec follows the
  // colon directly, a dict value after a space, so a space leaves both readings.
  const dict = dictBody(s);
  if (dict) {
    const dictForm = `{ {${s}} }`;
    if (isStringLiteral(base) || dict.commas.length > 0) {
      return {
        open: false,
        problem: `{${raw}}: debugpy evaluates the text between braces as a Python expression, so a dict needs its own braces; use ${dictForm} instead.`
      };
    }
    if (/^\s/.test(spec)) {
      return { open: false, problem: sentence(raw, `:${spec}`, `{${call}} for a format spec, or ${dictForm} for a dict,`) };
    }
  }
  return { open: false, problem: sentence(raw, suffix === ':' ? "':'" : suffix, `{${call}}`) };
}

/**
 * Return a refusal naming each `{...}` group of a Python `logMessage` that is
 * certain to log a syntax error (an f-string conversion, format spec or `=` at
 * its top level) and the form that works, or `undefined` when none is.
 */
export function validatePythonLogMessage(logMessage: string): string | undefined {
  const problems: string[] = [];
  for (const group of extractPythonLogMessageGroups(logMessage) ?? []) {
    const verdict = inspectGroup(group);
    if (verdict.problem) problems.push(verdict.problem);
    if (verdict.open) break;
  }
  if (problems.length === 0) return undefined;
  const more = problems.length - MAX_NAMED_GROUPS;
  const named = problems.slice(0, MAX_NAMED_GROUPS).join(' ');
  return more > 0 ? `${named} And ${more} more like ${more === 1 ? 'it' : 'these'}.` : named;
}
