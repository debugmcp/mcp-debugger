/**
 * The COBOL data-reference grammar `evaluate` understands:
 *
 *   expr       := prefix? ( 'LENGTH' 'OF' dataref | 'ADDRESS' 'OF' dataref | dataref )
 *   prefix     := '/hex' | '/raw' | '/addr' | '/len'
 *   dataref    := qualname subscripts? refmod?
 *   qualname   := IDENT (('OF'|'IN') IDENT)*
 *   subscripts := '(' subexpr ((','|' ') subexpr)* ')'
 *   subexpr    := INTEGER | IDENT (('+'|'-') INTEGER)?
 *   refmod     := '(' (INTEGER|IDENT) ':' (INTEGER|IDENT)? ')'
 *
 * Identifiers are `[A-Z0-9_][A-Z0-9_-]*` with at least one letter, case-insensitive (cobc
 * accepts `_` in words under every -std).
 * Anything that does not parse is not a COBOL reference and goes to the engine
 * untouched (`b_17`, `$rcx`, `1+2`); the parser answers `undefined` for it
 * rather than an error, because "not ours" is the common case, not a fault.
 */

export type ShimPrefix = '/hex' | '/raw' | '/addr' | '/len';

export type SubscriptOperand = { kind: 'int'; value: number } | { kind: 'ident'; name: string; delta: number };
export type RefmodOperand = { kind: 'int'; value: number } | { kind: 'ident'; name: string };

export interface CobolDataRef {
  /** `[NAME, QUALIFIER1, QUALIFIER2, …]` as written: `NAME OF QUALIFIER1 OF QUALIFIER2`. */
  names: string[];
  subscripts: SubscriptOperand[];
  refmod?: { start: RefmodOperand; length?: RefmodOperand };
}

export interface CobolExpression {
  prefix?: ShimPrefix;
  fn?: 'LENGTH' | 'ADDRESS';
  ref: CobolDataRef;
}

type Punct = '(' | ')' | ',' | ':' | '+' | '-';

type Token =
  | { kind: 'ident'; text: string }
  | { kind: 'int'; value: number }
  | { kind: 'punct'; text: Punct };

const PREFIXES: readonly ShimPrefix[] = ['/hex', '/raw', '/addr', '/len'];
const WORD = /^[A-Z0-9_]+(?:-[A-Z0-9_]+)*/;

function tokenize(text: string): Token[] | undefined {
  const tokens: Token[] = [];
  let rest = text;
  while (rest.length > 0) {
    const trimmed = rest.replace(/^\s+/, '');
    if (trimmed.length === 0) {
      break;
    }
    const word = WORD.exec(trimmed);
    if (word) {
      const w = word[0];
      if (/^\d+$/.test(w)) {
        tokens.push({ kind: 'int', value: Number(w) });
      } else if (/[A-Z]/.test(w)) {
        tokens.push({ kind: 'ident', text: w });
      } else {
        return undefined; // digits and hyphens only: neither a number nor a name
      }
      rest = trimmed.slice(w.length);
      continue;
    }
    const ch = trimmed[0];
    if (ch === '(' || ch === ')' || ch === ',' || ch === ':' || ch === '+' || ch === '-') {
      tokens.push({ kind: 'punct', text: ch as Punct });
      rest = trimmed.slice(1);
      continue;
    }
    return undefined;
  }
  return tokens;
}

class Parser {
  private pos = 0;

  constructor(private readonly tokens: Token[]) {}

  get done(): boolean {
    return this.pos >= this.tokens.length;
  }

  private peek(offset = 0): Token | undefined {
    return this.tokens[this.pos + offset];
  }

  private isIdent(text: string, offset = 0): boolean {
    const t = this.peek(offset);
    return t?.kind === 'ident' && t.text === text;
  }

  private isPunct(text: Punct, offset = 0): boolean {
    const t = this.peek(offset);
    return t?.kind === 'punct' && t.text === text;
  }

  private takeIdent(): string | undefined {
    const t = this.peek();
    if (t?.kind === 'ident') {
      this.pos += 1;
      return t.text;
    }
    return undefined;
  }

  private takeInt(): number | undefined {
    const t = this.peek();
    if (t?.kind === 'int') {
      this.pos += 1;
      return t.value;
    }
    return undefined;
  }

  parseExpression(): Omit<CobolExpression, 'prefix'> | undefined {
    let fn: CobolExpression['fn'];
    if ((this.isIdent('LENGTH') || this.isIdent('ADDRESS')) && this.isIdent('OF', 1)) {
      fn = this.takeIdent() as 'LENGTH' | 'ADDRESS';
      this.pos += 1;
    }
    const ref = this.parseDataRef();
    if (!ref || !this.done) {
      return undefined;
    }
    return fn ? { fn, ref } : { ref };
  }

  private parseDataRef(): CobolDataRef | undefined {
    const first = this.takeIdent();
    if (first === undefined || first === 'OF' || first === 'IN') {
      return undefined;
    }
    const names = [first];
    while (this.isIdent('OF') || this.isIdent('IN')) {
      this.pos += 1;
      const qualifier = this.takeIdent();
      if (qualifier === undefined) {
        return undefined;
      }
      names.push(qualifier);
    }
    const ref: CobolDataRef = { names, subscripts: [] };
    let sawSubscripts = false;
    while (this.isPunct('(')) {
      if (ref.refmod) {
        return undefined; // nothing may follow a reference modification
      }
      const group = this.parseParenGroup();
      if (!group) {
        return undefined;
      }
      if (group.kind === 'refmod') {
        ref.refmod = group.refmod;
      } else if (sawSubscripts) {
        return undefined;
      } else {
        ref.subscripts = group.subscripts;
        sawSubscripts = true;
      }
    }
    return ref;
  }

  private parseParenGroup():
    | { kind: 'subscripts'; subscripts: SubscriptOperand[] }
    | { kind: 'refmod'; refmod: NonNullable<CobolDataRef['refmod']> }
    | undefined {
    this.pos += 1; // '('
    // Look ahead for ':' before the matching ')': that is a reference modification.
    let depth = 0;
    let isRefmod = false;
    for (let i = this.pos; i < this.tokens.length; i++) {
      const t = this.tokens[i];
      if (t.kind !== 'punct') {
        continue;
      }
      if (t.text === '(') {
        depth += 1;
      } else if (t.text === ')') {
        if (depth === 0) {
          break;
        }
        depth -= 1;
      } else if (t.text === ':' && depth === 0) {
        isRefmod = true;
      }
    }
    if (isRefmod) {
      const start = this.parseRefmodOperand();
      if (!start || !this.isPunct(':')) {
        return undefined;
      }
      this.pos += 1;
      let length: RefmodOperand | undefined;
      if (!this.isPunct(')')) {
        length = this.parseRefmodOperand();
        if (!length) {
          return undefined;
        }
      }
      if (!this.isPunct(')')) {
        return undefined;
      }
      this.pos += 1;
      return { kind: 'refmod', refmod: length ? { start, length } : { start } };
    }
    const subscripts: SubscriptOperand[] = [];
    while (!this.isPunct(')')) {
      if (this.isPunct(',')) {
        this.pos += 1;
        continue;
      }
      const operand = this.parseSubscript();
      if (!operand) {
        return undefined;
      }
      subscripts.push(operand);
    }
    this.pos += 1; // ')'
    return subscripts.length > 0 ? { kind: 'subscripts', subscripts } : undefined;
  }

  private parseSubscript(): SubscriptOperand | undefined {
    const int = this.takeInt();
    if (int !== undefined) {
      return { kind: 'int', value: int };
    }
    const name = this.takeIdent();
    if (name === undefined) {
      return undefined;
    }
    let delta = 0;
    if (this.isPunct('+') || this.isPunct('-')) {
      const sign = this.isPunct('-') ? -1 : 1;
      this.pos += 1;
      const amount = this.takeInt();
      if (amount === undefined) {
        return undefined;
      }
      delta = sign * amount;
    }
    return { kind: 'ident', name, delta };
  }

  private parseRefmodOperand(): RefmodOperand | undefined {
    const int = this.takeInt();
    if (int !== undefined) {
      return { kind: 'int', value: int };
    }
    const name = this.takeIdent();
    return name === undefined ? undefined : { kind: 'ident', name };
  }
}

/** `undefined` when the text is not a COBOL data reference at all (let the engine have it). */
export function parseCobolExpression(text: string): CobolExpression | undefined {
  let source = text.trim();
  let prefix: ShimPrefix | undefined;
  const lower = source.toLowerCase();
  for (const candidate of PREFIXES) {
    if (lower.startsWith(candidate) && /\s/.test(source.charAt(candidate.length))) {
      prefix = candidate;
      source = source.slice(candidate.length).trim();
      break;
    }
  }
  const tokens = tokenize(source.toUpperCase());
  if (!tokens || tokens.length === 0) {
    return undefined;
  }
  const parsed = new Parser(tokens).parseExpression();
  if (!parsed) {
    return undefined;
  }
  return prefix ? { prefix, ...parsed } : parsed;
}
