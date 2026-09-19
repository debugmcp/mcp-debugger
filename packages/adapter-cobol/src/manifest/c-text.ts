/**
 * Line- and token-level helpers for reading cobc's generated C.
 *
 * The generated C is regular enough that a real C parser would be overkill — and brittle
 * across cobc versions, which differ in whitespace (`COB_SET_FLD (f0,` vs `COB_SET_FLD(f0,`)
 * more than in structure. Every parser in this directory works one line at a time and only
 * needs to (a) split argument lists that contain nested calls and string literals and
 * (b) turn the handful of C expression shapes cobc uses for data addresses into a
 * (symbol, offset) pair.
 */

/** Split on LF or CRLF; cobc on Windows writes CRLF and the fixtures keep it. */
export function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
}

/** Last path segment regardless of separator — `#line` paths mix `/` and `\` on Windows. */
export function baseName(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] ?? p;
}

function scanLiteral(s: string, i: number, quote: string): number {
  // Returns the index just past the closing quote (or s.length when unterminated).
  let j = i + 1;
  while (j < s.length) {
    const ch = s[j];
    if (ch === '\\') {
      j += 2;
      continue;
    }
    if (ch === quote) {
      return j + 1;
    }
    j += 1;
  }
  return s.length;
}

/**
 * Index of the bracket closing the one at `openIdx`, honouring nesting and string/char
 * literals; -1 when unbalanced. Works for `(`, `[` and `{`.
 */
export function findMatchingBracket(s: string, openIdx: number): number {
  const open = s[openIdx];
  const close = open === '(' ? ')' : open === '[' ? ']' : open === '{' ? '}' : undefined;
  if (close === undefined) {
    return -1;
  }
  let depth = 0;
  let i = openIdx;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '"' || ch === '\'') {
      i = scanLiteral(s, i, ch);
      continue;
    }
    if (ch === open) {
      depth += 1;
    } else if (ch === close) {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
    i += 1;
  }
  return -1;
}

/** Split a C argument list on the commas at nesting depth 0; parts are trimmed. */
export function splitTopLevelArgs(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '"' || ch === '\'') {
      i = scanLiteral(s, i, ch);
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') {
      depth += 1;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      depth -= 1;
    } else if (ch === ',' && depth === 0) {
      parts.push(s.slice(start, i).trim());
      start = i + 1;
    }
    i += 1;
  }
  const last = s.slice(start).trim();
  if (last.length > 0 || parts.length > 0) {
    parts.push(last);
  }
  return parts;
}

const SIMPLE_ESCAPES: Record<string, string> = {
  n: '\n',
  t: '\t',
  r: '\r',
  a: '\x07',
  b: '\b',
  f: '\f',
  v: '\v',
  '0': '\0'
};

/** Decode the C escapes cobc emits in `#line` paths and literal constants (`\\`, `\"`, octal, hex). */
export function unescapeCString(s: string): string {
  return s.replace(/\\(x[0-9a-fA-F]{1,2}|[0-7]{1,3}|.)/g, (_whole, esc: string) => {
    if (esc[0] === 'x' && esc.length > 1) {
      return String.fromCharCode(parseInt(esc.slice(1), 16));
    }
    if (/^[0-7]+$/.test(esc)) {
      return String.fromCharCode(parseInt(esc, 8));
    }
    return SIMPLE_ESCAPES[esc] ?? esc;
  });
}

/** Strip one layer of surrounding double quotes and decode escapes; other text is returned as-is. */
export function unquoteCString(s: string): string {
  const t = s.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    return unescapeCString(t.slice(1, -1));
  }
  return t;
}

export interface DataExpr {
  /**
   * `null` for a literal NULL, `register` for `&sym` (special registers stored as C ints),
   * `local` for `cob_local_ptr [+ n]`, `symbol` for `b_N [+ n]` (static array or pointer).
   */
  kind: 'null' | 'register' | 'local' | 'symbol';
  symbol: string;
  offset: number;
}

const CAST_RE = /^\(\s*(?:const\s+)?(?:cob_u8_t|cob_u8_ptr|unsigned\s+char|char|void|cob_field)\s*\*?\s*\)\s*/;

/**
 * Parse the data-address expressions cobc writes into `COB_SET_FLD`, `cob_field` initialisers
 * and `cob_get_numdisp` calls. Casts and redundant parentheses are ignored. Returns undefined
 * for anything else (a runtime-computed address the manifest cannot describe statically).
 */
export function parseDataExpr(expr: string): DataExpr | undefined {
  let s = expr.trim();
  for (;;) {
    const cast = CAST_RE.exec(s);
    if (cast) {
      s = s.slice(cast[0].length).trim();
      continue;
    }
    if (s.startsWith('(') && findMatchingBracket(s, 0) === s.length - 1) {
      s = s.slice(1, -1).trim();
      continue;
    }
    break;
  }
  if (s === 'NULL' || s === '0') {
    return { kind: 'null', symbol: '', offset: 0 };
  }
  const reg = /^&\s*([A-Za-z_]\w*)$/.exec(s);
  if (reg) {
    return { kind: 'register', symbol: reg[1], offset: 0 };
  }
  const plain = /^([A-Za-z_]\w*)(?:\s*\+\s*(\d+)(?:[uU]?[lL]{0,2})?)?$/.exec(s);
  if (plain) {
    const symbol = plain[1];
    const offset = plain[2] ? parseInt(plain[2], 10) : 0;
    return { kind: symbol === 'cob_local_ptr' ? 'local' : 'symbol', symbol, offset };
  }
  return undefined;
}

/** `/* comment *\/` text on a line, trimmed; undefined when there is none. */
export function trailingComment(line: string): string | undefined {
  const m = /\/\*\s*(.*?)\s*\*\//.exec(line);
  return m ? m[1] : undefined;
}
