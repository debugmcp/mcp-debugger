/**
 * Reading JavaScript source just far enough to answer two questions for the
 * proxy's stepper (issues #1130, #1161): is a function async or a generator
 * (`functionKind`, from its header), and can a frame of one suspend between a
 * call returning and its next break location (`statementCanSuspend`)?
 *
 * Measured on V8 13.6: every statement has a break location at its start (a
 * statement that begins with a call has it at that call), and every call is
 * one. So a frame that returns from a call reaches a break location before it
 * can suspend unless the statement making the call awaits or yields, or the
 * function suspends without a keyword in that statement (`for await`,
 * `await using`, a `return` in an async generator, which awaits its value).
 *
 * This is not a parser. It masks out strings and comments, finds the
 * statement around a position by brackets, semicolons and line breaks, and
 * errs toward "can suspend" whenever it is unsure: an unterminated string,
 * template or comment on a line it reads, a statement longer than it will
 * scan, an ambiguous line break. "Can suspend" costs a rescue; "cannot" when
 * the frame can would cost a wrong landing.
 */

/** How many lines a statement may span before the scan gives up (and says it can suspend). */
const MAX_STATEMENT_LINES = 40;

const SUSPENDS = /\b(await|yield)\b/;
const IMPLICIT_SUSPENSION = /\bfor\s+await\b|\bawait\s+using\b/;

/** A line with its strings and comments blanked out; `unsafe` when it cannot be blanked with confidence. */
interface MaskedLine {
  code: string;
  unsafe: boolean;
}

/** What a line starts inside of, carried from the line before. */
interface MaskState {
  /** A `/* ... *\/` comment. */
  comment: boolean;
  /** A template literal that did not end on its line. */
  template: boolean;
}

function maskLines(lines: readonly string[], from: number, to: number): MaskedLine[] {
  const state: MaskState = { comment: false, template: false };
  const masked: MaskedLine[] = [];
  for (let i = from; i <= to; i++) {
    masked.push(maskLine(lines[i] ?? '', state));
  }
  return masked;
}

/**
 * Blank string, template and comment contents on one line, keeping columns.
 * `state` carries a block comment and a template literal across lines. A
 * line inside a template that spans lines, a string that does not end on its
 * line, a template expression, and anything that looks like a regular
 * expression literal make the line unsafe.
 */
function maskLine(line: string, state: MaskState): MaskedLine {
  let code = '';
  let unsafe = false;
  let i = 0;
  if (state.template) {
    unsafe = true;
    let j = 0;
    while (j < line.length && line[j] !== '`') {
      j += line[j] === '\\' ? 2 : 1;
    }
    if (j >= line.length) {
      return { code: ' '.repeat(line.length), unsafe };
    }
    code = ' '.repeat(j) + '`';
    i = j + 1;
    state.template = false;
  }
  while (i < line.length) {
    const ch = line[i];
    if (state.comment) {
      const end = line.indexOf('*/', i);
      if (end === -1) {
        code += ' '.repeat(line.length - i);
        return { code, unsafe };
      }
      code += ' '.repeat(end + 2 - i);
      i = end + 2;
      state.comment = false;
      continue;
    }
    if (ch === '/' && line[i + 1] === '/') {
      // After a lone slash on the line (a division, or a regular expression
      // whose own slashes these may be) this is not surely a comment.
      if (code.includes('/')) {
        unsafe = true;
      }
      code += ' '.repeat(line.length - i);
      return { code, unsafe };
    }
    if (ch === '/' && line[i + 1] === '*') {
      state.comment = true;
      code += '  ';
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1;
      while (j < line.length && line[j] !== ch) {
        if (line[j] === '\\') {
          j++;
        } else if (ch === '`' && line[j] === '$' && line[j + 1] === '{') {
          // An expression inside a template: not read.
          unsafe = true;
        }
        j++;
      }
      if (j >= line.length) {
        // Not closed on this line (or a line continuation): not read with confidence.
        unsafe = true;
        if (ch === '`') {
          state.template = true;
        }
        code += ' '.repeat(line.length - i);
        return { code, unsafe };
      }
      code += ch + ' '.repeat(j - i - 1) + ch;
      i = j + 1;
      continue;
    }
    if (ch === '/') {
      // Division or a regular expression literal: told apart only by context.
      const before = code.trimEnd();
      const prev = before[before.length - 1] ?? '';
      if (prev === '' || /[(,=:[!&|?{};+\-*%<>~^]/.test(prev) || /\b(return|typeof|case|do|else|in|of|yield|await)$/.test(before)) {
        unsafe = true;
      }
    }
    code += ch;
    i++;
  }
  return { code, unsafe };
}

/** Whether a line break between these two lines ends a statement (automatic semicolon insertion). */
function lineBreakEndsStatement(previous: string, next: string): boolean {
  const before = previous.trimEnd();
  const after = next.trimStart();
  if (before === '' || after === '') {
    return false;
  }
  const last = before[before.length - 1];
  const first = after[0];
  // The line before must end like an expression or a statement can end ...
  if (!/[\w$)\]}"'`]/.test(last)) {
    return false;
  }
  if (/\b(await|yield|return|new|typeof|instanceof|in|of|void|delete|case|else|extends)$/.test(before)) {
    return false;
  }
  // ... and the next must start like a statement, not continue an expression.
  return /[\w$'"{}]/.test(first) && !/^(in|of|instanceof)\b/.test(after);
}

/**
 * Whether the statement containing `column` of `line` (0-based) awaits or
 * yields, or the function containing it can suspend without saying so in
 * that statement. `from` and `to` bound the function's own lines. Errs toward
 * true.
 */
export function statementCanSuspend(
  lines: readonly string[],
  line: number,
  column: number,
  from: number,
  to: number,
  options: { asyncGenerator?: boolean } = {}
): boolean {
  const first = Math.max(0, from);
  const last = Math.min(lines.length - 1, to);
  if (line < first || line > last) {
    return true;
  }
  const masked = maskLines(lines, first, last);
  const at = (n: number): MaskedLine => masked[n - first];
  if (masked.some((entry) => IMPLICIT_SUSPENSION.test(entry.code))) {
    return true;
  }

  // Backward to the start of the statement.
  let startLine = line;
  let startCol = 0;
  {
    let depth = 0;
    let n = line;
    let c = column - 1;
    let found = false;
    while (!found) {
      const code = at(n).code;
      for (; c >= 0; c--) {
        const ch = code[c];
        if (ch === ')' || ch === ']') {
          depth++;
        } else if (ch === '(' || ch === '[') {
          depth = Math.max(0, depth - 1);
        } else if (ch === '}') {
          if (depth === 0 && code.slice(c + 1).trim() === '' && n < line && lineBreakEndsStatement(code, at(n + 1).code)) {
            // A brace that ends its line, before the statement's line, and
            // the next line starts a statement: the end of an earlier block.
            startLine = n + 1;
            startCol = 0;
            found = true;
            break;
          }
          depth++;
        } else if (ch === '{') {
          if (depth > 0) {
            depth--;
          } else {
            const before = code.slice(0, c).trimEnd();
            const prev = before[before.length - 1] ?? '';
            const objectLiteral = /[(,=:[?!&|.]/.test(prev) || /\b(return|await|yield)$/.test(before);
            if (!objectLiteral) {
              startLine = n;
              startCol = c + 1;
              found = true;
              break;
            }
          }
        } else if (ch === ';' && depth === 0) {
          startLine = n;
          startCol = c + 1;
          found = true;
          break;
        }
      }
      if (found) {
        break;
      }
      if (n === first) {
        startLine = first;
        startCol = 0;
        break;
      }
      if (line - n >= MAX_STATEMENT_LINES) {
        return true;
      }
      if (depth === 0 && lineBreakEndsStatement(at(n - 1).code, code)) {
        startLine = n;
        startCol = 0;
        break;
      }
      n--;
      c = at(n).code.length - 1;
    }
  }

  // Forward to its end.
  let endLine = line;
  let endCol = at(line).code.length;
  {
    let depth = 0;
    let n = line;
    let c = column;
    let found = false;
    while (!found) {
      const code = at(n).code;
      for (; c < code.length; c++) {
        const ch = code[c];
        if (ch === '(' || ch === '[' || ch === '{') {
          depth++;
        } else if (ch === ')' || ch === ']' || ch === '}') {
          // Closing a group the statement started in: it goes on after it.
          depth = Math.max(0, depth - 1);
        } else if (ch === ';' && depth === 0) {
          endLine = n;
          endCol = c;
          found = true;
          break;
        }
      }
      if (found) {
        break;
      }
      if (n === last) {
        endLine = last;
        endCol = code.length;
        break;
      }
      if (n - line >= MAX_STATEMENT_LINES) {
        return true;
      }
      if (depth === 0 && lineBreakEndsStatement(code, at(n + 1).code)) {
        endLine = n;
        endCol = code.length;
        break;
      }
      n++;
      c = 0;
    }
  }

  let text = '';
  for (let n = startLine; n <= endLine; n++) {
    const entry = at(n);
    if (entry.unsafe) {
      return true;
    }
    const from = n === startLine ? startCol : 0;
    const to = n === endLine ? endCol : entry.code.length;
    text += entry.code.slice(from, to) + '\n';
  }
  if (options.asyncGenerator && /\breturn\b/.test(text)) {
    // An async generator's return awaits its value.
    return true;
  }
  return SUSPENDS.test(text);
}

/** What a function's header says it is. */
export interface FunctionKind {
  async: boolean;
  generator: boolean;
}

/** Header words that can stand before a method's or function's name. */
const MODIFIERS = new Set(['async', 'function', 'static', 'get', 'set', 'accessor']);

/**
 * Whether the function whose header V8's functionLocation points at is async
 * or a generator; null when the header cannot be read with confidence. V8
 * points at the parameter list of a function or a method, with
 * `[static] [async] [function] [*] [get|set] name` before it, and at the
 * first token of an arrow (`async` itself for an async one). The name may be
 * an identifier, a private name, a string or a computed key: it is skipped as
 * a token, so what it contains does not matter. Reads at most a few lines
 * back.
 */
export function functionKind(lines: readonly string[], line: number, column: number): FunctionKind | null {
  const first = Math.max(0, line - 4);
  const masked = maskLines(lines, first, line);
  if (masked.some((entry) => entry.unsafe)) {
    return null;
  }
  const text = masked.map((entry) => entry.code).join('\n');
  let p = masked.slice(0, line - first).reduce((sum, entry) => sum + entry.code.length + 1, 0) + column;
  const original = lines[line] ?? '';
  if (/^async\b/.test(original.slice(column))) {
    return { async: true, generator: false };
  }
  if (text[p] !== '(') {
    // An arrow with one bare parameter, or a script's own code: plain.
    return { async: false, generator: false };
  }
  const isWord = (ch: string | undefined): boolean => ch !== undefined && /[\w$#]/.test(ch);
  const skipSpace = (): void => {
    while (p > 0 && /\s/.test(text[p - 1])) {
      p--;
    }
  };
  const word = (): string => {
    const end = p;
    while (p > 0 && isWord(text[p - 1])) {
      p--;
    }
    return text.slice(p, end);
  };
  const kind: FunctionKind = { async: false, generator: false };

  // The name: an identifier, a string, or a computed key; or none (an arrow, an anonymous function).
  skipSpace();
  const last = text[p - 1];
  if (last === undefined) {
    return null;
  }
  if (last === ']') {
    let depth = 0;
    do {
      p--;
      if (text[p] === ']') {
        depth++;
      } else if (text[p] === '[') {
        depth--;
      }
    } while (p > 0 && depth > 0);
    if (depth !== 0) {
      return null;
    }
  } else if (last === '"' || last === "'") {
    p--;
    while (p > 0 && text[p - 1] !== last) {
      p--;
    }
    if (p === 0) {
      return null;
    }
    p--;
  } else if (isWord(last)) {
    const name = word();
    if (name === 'function') {
      p += name.length;
    }
  } else if (last !== '*') {
    // `= (`, `, (`, `((`: the parameter list of an arrow.
    return kind;
  }

  // Then `*`, and the modifiers.
  for (;;) {
    skipSpace();
    if (text[p - 1] === '*') {
      kind.generator = true;
      p--;
      continue;
    }
    if (!isWord(text[p - 1])) {
      return kind;
    }
    const before = p;
    const modifier = word();
    if (!MODIFIERS.has(modifier)) {
      p = before;
      return kind;
    }
    if (modifier === 'async') {
      kind.async = true;
    }
  }
}
