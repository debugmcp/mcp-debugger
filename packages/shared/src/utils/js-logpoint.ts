/**
 * JavaScript logpoints compiled by mcp-debugger (issues #850, #853, #861).
 *
 * js-debug compiles a DAP logMessage into `console.log(...), false` and
 * evaluates it in the debuggee, so a program that replaced `console.log`
 * (mcp-debugger's own stdio server does) loses every logpoint silently, and
 * a logpoint carrying a `condition` is a pausing breakpoint to js-debug
 * (its precedence is condition → logMessage). Instead of forwarding the
 * logMessage, the JavaScript policy sends a breakpoint `condition` built
 * here: it evaluates the user's condition, renders the message, hands it to
 * the CDP binding the proxy worker installs (`Runtime.addBinding`), falling
 * back to `console.log` when the binding is absent, and returns false so V8
 * never pauses. The stored breakpoint keeps the user's logMessage and
 * condition; only the wire form changes.
 *
 * The template is ES2019 (js-debug wraps and acorn-parses it) and a pure
 * function of its inputs, so js-debug's equivalentTo() dedupe on re-sends
 * keeps working.
 */

/** Global installed in the debuggee by the proxy worker's CDP bridge. */
export const JS_LOGPOINT_BINDING = '__mcpDebuggerLogpoint';

export type LogMessagePart =
  | { kind: 'text'; text: string }
  | { kind: 'expr'; source: string };

/**
 * Index just past the `}` that closes the `{` at `open`, or -1 when none
 * does. Tracks brace depth outside of '…', "…" and `…` (with `${…}` nesting)
 * so a brace inside a string or a nested object literal does not end the
 * expression. Regex literals and comments are not tokenised.
 */
function findExpressionEnd(message: string, open: number): number {
  let depth = 0;
  let i = open;
  const n = message.length;
  while (i < n) {
    const ch = message[i];
    if (ch === "'" || ch === '"') {
      i = skipQuoted(message, i, ch);
      continue;
    }
    if (ch === '`') {
      i = skipTemplate(message, i);
      if (i < 0) {
        return -1;
      }
      continue;
    }
    if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return i + 1;
      }
    }
    i += 1;
  }
  return -1;
}

/** Index past the closing quote (or the end of the message if unterminated). */
function skipQuoted(message: string, start: number, quote: string): number {
  let i = start + 1;
  while (i < message.length) {
    const ch = message[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === quote) {
      return i + 1;
    }
    i += 1;
  }
  return message.length;
}

/** Index past the closing backtick, honouring `${…}` nesting; -1 if unterminated. */
function skipTemplate(message: string, start: number): number {
  let i = start + 1;
  while (i < message.length) {
    const ch = message[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '`') {
      return i + 1;
    }
    if (ch === '$' && message[i + 1] === '{') {
      const end = findExpressionEnd(message, i + 1);
      if (end < 0) {
        return -1;
      }
      i = end;
      continue;
    }
    i += 1;
  }
  return -1;
}

/**
 * Split a logMessage into literal text and `{expression}` parts. Never
 * throws: an unclosed `{`, an empty `{}` and a stray `}` are literal text
 * (js-debug's own rules); `{{foo}}` yields the expression `{foo}`, which the
 * compiler wraps in parentheses — the object-literal shorthand.
 */
export function parseJsLogMessage(message: string): LogMessagePart[] {
  const parts: LogMessagePart[] = [];
  let text = '';
  let i = 0;
  while (i < message.length) {
    const open = message.indexOf('{', i);
    if (open < 0) {
      text += message.slice(i);
      break;
    }
    text += message.slice(i, open);
    const end = findExpressionEnd(message, open);
    if (end < 0) {
      // No expression closes here (no `}`, or a quote runs to the end): this
      // brace is literal text and the groups after it still count.
      text += '{';
      i = open + 1;
      continue;
    }
    const source = message.slice(open + 1, end - 1);
    if (source.trim() === '') {
      text += message.slice(open, end);
      i = end;
      continue;
    }
    if (text) {
      parts.push({ kind: 'text', text });
      text = '';
    }
    parts.push({ kind: 'expr', source });
    i = end;
  }
  if (text) {
    parts.push({ kind: 'text', text });
  }
  return parts;
}

/**
 * Syntax check only — the function is never invoked. This is the check
 * js-debug applies to every breakpoint condition (`new Function(expr)`); we
 * run it before the breakpoint is sent so the error lands in the
 * set_breakpoint response instead of js-debug's stderr (issue #853).
 */
function syntaxErrorIn(body: string): string | undefined {
  try {
    new Function(body);
    return undefined;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

/**
 * First problem with a logMessage (each `{expr}`) and its optional
 * condition, worded for the caller; undefined when everything parses. The
 * rule is V8's, as it is for js-debug: each expression must parse on its
 * own, and the compiled template must parse with them in place — which is
 * what refuses `a) + (b` (valid alone as `return (a) + (b)`, but a `;` or a
 * stray `)` cannot sit inside the template's call arguments). Regex
 * literals, comments and bracket characters inside strings are fine.
 */
export function validateJsLogpoint(logMessage: string, condition?: string): string | undefined {
  return validateParts(parseJsLogMessage(logMessage), condition);
}

function validateParts(parts: LogMessagePart[], condition?: string): string | undefined {
  for (const part of parts) {
    if (part.kind !== 'expr') {
      continue;
    }
    const error = syntaxErrorIn(`return (\n${part.source}\n)`);
    if (error) {
      return `logMessage expression {${part.source}}: ${error}`;
    }
  }
  if (condition !== undefined && condition.trim() !== '') {
    const error = syntaxErrorIn(`return (\n${condition}\n)`);
    if (error) {
      return `condition ${JSON.stringify(condition)}: ${error}`;
    }
  }
  const whole = syntaxErrorIn(renderCondition(parts, condition));
  if (whole) {
    const culprit = parts.find((part) => part.kind === 'expr');
    return culprit?.kind === 'expr'
      ? `logMessage expression {${culprit.source}} is not one expression (${whole})`
      : `condition ${JSON.stringify(condition ?? '')} is not one expression (${whole})`;
  }
  return undefined;
}

export type CompiledJsLogpoint =
  | { ok: true; condition: string }
  | { ok: false; error: string };

/** Strings print raw; everything else through util.inspect (one line). */
const STRINGIFY = `const __mcpStr = (v) => {
    if (typeof v === 'string') return v;
    let u = null;
    try {
      if (typeof process === 'object' && process !== null && typeof process.getBuiltinModule === 'function') u = process.getBuiltinModule('node:util');
      else if (typeof require === 'function') u = require('util');
    } catch (e) { u = null; }
    if (u && typeof u.inspect === 'function') return u.inspect(v, { breakLength: Infinity });
    try { return (typeof v === 'object' && v !== null) ? JSON.stringify(v) : String(v); } catch (e) { return String(v); }
  };
  const __mcpErr = (e) => (e && e.name ? e.name + ': ' + e.message : String(e));
  const __mcpEval = (f) => { try { return __mcpStr(f()); } catch (e) { return '<' + __mcpErr(e) + '>'; } };
  const __mcpEmit = (m) => { if (typeof ${JS_LOGPOINT_BINDING} === 'function') ${JS_LOGPOINT_BINDING}(m); else console.log(m); };`;

/**
 * Compile a logpoint (and its optional condition) into the breakpoint
 * condition js-debug receives. Validation failures are returned, never
 * thrown, so a send path can fall back to the plain wire form.
 */
export function compileJsLogpoint(bp: { logMessage: string; condition?: string }): CompiledJsLogpoint {
  const parts = parseJsLogMessage(bp.logMessage);
  const error = validateParts(parts, bp.condition);
  if (error) {
    return { ok: false, error };
  }
  return { ok: true, condition: renderCondition(parts, bp.condition) };
}

function renderCondition(parts: LogMessagePart[], condition?: string): string {
  const message = parts.length === 0
    ? '""'
    : parts
        .map((part) => (part.kind === 'text' ? JSON.stringify(part.text) : `__mcpEval(() => (\n${part.source}\n))`))
        .join(' + ');
  const gate = condition !== undefined && condition.trim() !== ''
    ? `let __mcpCond;
  try { __mcpCond = !!(\n${condition}\n); } catch (e) { __mcpEmit('Logpoint condition error: ' + __mcpErr(e)); return false; }
  if (!__mcpCond) return false;
  `
    : '';
  return `(() => {
  ${STRINGIFY}
  ${gate}__mcpEmit(${message});
  return false;
})()`;
}
