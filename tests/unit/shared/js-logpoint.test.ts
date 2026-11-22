import { describe, it, expect, afterEach } from 'vitest';
import {
  JS_LOGPOINT_BINDING,
  JS_LOGPOINT_DROPPED,
  JS_LOGPOINT_FLUSH,
  JS_LOGPOINT_QUEUE,
  JS_LOGPOINT_QUEUE_LIMIT,
  parseJsLogMessage,
  validateJsLogpoint,
  compileJsLogpoint
} from '../../../packages/shared/src/utils/js-logpoint.js';

/**
 * mcp-debugger compiles JavaScript logpoints itself (issues #850, #853, #861):
 * the wire form sent to js-debug is a breakpoint `condition` that evaluates
 * the user's condition, builds the message, hands it to the CDP binding the
 * proxy installs (kept in the process while the binding is absent, issue #1212) and returns false.
 */
describe('parseJsLogMessage', () => {
  it('splits text and {expr} parts', () => {
    expect(parseJsLogMessage('order={orderId} total={total}')).toEqual([
      { kind: 'text', text: 'order=' },
      { kind: 'expr', source: 'orderId' },
      { kind: 'text', text: ' total=' },
      { kind: 'expr', source: 'total' }
    ]);
  });

  it('keeps braces balanced across nested object literals, strings and template literals', () => {
    expect(parseJsLogMessage('a={JSON.stringify({x: "}"})} b={`${y}}`} c={[1,{z:2}]}')).toEqual([
      { kind: 'text', text: 'a=' },
      { kind: 'expr', source: 'JSON.stringify({x: "}"})' },
      { kind: 'text', text: ' b=' },
      { kind: 'expr', source: '`${y}}`' },
      { kind: 'text', text: ' c=' },
      { kind: 'expr', source: '[1,{z:2}]' }
    ]);
  });

  it('treats an unclosed brace, an empty brace pair and a stray closing brace as literal text', () => {
    expect(parseJsLogMessage('open {x')).toEqual([{ kind: 'text', text: 'open {x' }]);
    expect(parseJsLogMessage('empty {} and { } here')).toEqual([{ kind: 'text', text: 'empty {} and { } here' }]);
    expect(parseJsLogMessage('stray } brace')).toEqual([{ kind: 'text', text: 'stray } brace' }]);
  });

  it('keeps scanning after a brace group that is literal text with an apostrophe in it', () => {
    // {it's} never closes as an expression (the quote runs to the end), so it
    // is literal and the groups after it are still interpolated.
    expect(parseJsLogMessage("{it's} {x}")).toEqual([
      { kind: 'text', text: "{it's} " },
      { kind: 'expr', source: 'x' }
    ]);
    expect(parseJsLogMessage("open {x and {y}")).toEqual([
      { kind: 'text', text: 'open {x and ' },
      { kind: 'expr', source: 'y' }
    ]);
  });

  it('turns {{foo}} into the object-shorthand expression {foo}', () => {
    expect(parseJsLogMessage('v={{foo}}')).toEqual([
      { kind: 'text', text: 'v=' },
      { kind: 'expr', source: '{foo}' }
    ]);
  });

  it('returns a single text part for a message without interpolation', () => {
    expect(parseJsLogMessage('plain message')).toEqual([{ kind: 'text', text: 'plain message' }]);
    expect(parseJsLogMessage('')).toEqual([]);
  });
});

describe('validateJsLogpoint', () => {
  it('accepts valid interpolations and conditions', () => {
    expect(validateJsLogpoint('n={n} obj={JSON.stringify({a: 1})}')).toBeUndefined();
    expect(validateJsLogpoint('n={n}', 'n > 2')).toBeUndefined();
    expect(validateJsLogpoint('no interpolation at all')).toBeUndefined();
  });

  it('reports the syntax error of a malformed {expr} with V8 wording', () => {
    const error = validateJsLogpoint('n={n +}');
    expect(error).toMatch(/\{n \+\}/);
    expect(error).toMatch(/Unexpected token/);
  });

  it('reports a malformed condition', () => {
    expect(validateJsLogpoint('n={n}', 'n >=')).toMatch(/condition/);
  });

  it('accepts any expression V8 accepts — regex literals, comments, strings with brackets', () => {
    expect(validateJsLogpoint('m={/;/.test(s)} n={a /* ) */ + 1} o={"}" + "]"}')).toBeUndefined();
    expect(validateJsLogpoint('m={s}', '/\\)/.test(s)')).toBeUndefined();
  });

  it('refuses an expression that is not one expression, with V8 wording (a statement list, an escape of the wrapper)', () => {
    expect(validateJsLogpoint('x={a; b}')).toMatch(/\{a; b\}/);
    expect(validateJsLogpoint('x={a; b}')).toMatch(/Unexpected token/);
    // parses on its own as `return (a); b()` but cannot sit inside the template's call
    expect(validateJsLogpoint('x={a); b(}')).toMatch(/\{a\); b\(\}/);
    expect(validateJsLogpoint('x={a); b(}')).toMatch(/not one expression/);
    // harmless once wrapped: `(a) + (b)`
    expect(validateJsLogpoint('x={a) + (b}')).toBeUndefined();
  });
});

describe('compileJsLogpoint', () => {
  it('produces a deterministic condition that delivers through the binding, never prints and never pauses', () => {
    const first = compileJsLogpoint({ logMessage: 'n={n} done' });
    const second = compileJsLogpoint({ logMessage: 'n={n} done' });
    expect(first).toEqual(second);
    if (!first.ok) {
      throw new Error(first.error);
    }
    expect(first.condition).toContain(`typeof ${JS_LOGPOINT_BINDING} === 'function'`);
    // The program's stdout is the program's (issue #1212).
    expect(first.condition).not.toContain('console.');
    expect(first.condition).toContain(JS_LOGPOINT_QUEUE);
    expect(first.condition).toContain('"n="');
    expect(first.condition).toContain('" done"');
    expect(first.condition).toContain('\nn\n');
    expect(first.condition.trimEnd().endsWith('})()')).toBe(true);
    // js-debug syntax-checks a condition with exactly this call
    expect(() => new Function(first.condition)).not.toThrow();
  });

  it('runs: the compiled condition evaluates to false and emits the interpolated message once', () => {
    const compiled = compileJsLogpoint({ logMessage: 'n={n} obj={o} s={s} bad={missing}' });
    if (!compiled.ok) {
      throw new Error(compiled.error);
    }
    const emitted: string[] = [];
    const run = new Function(JS_LOGPOINT_BINDING, 'n', 'o', 's', `return (${compiled.condition});`);
    const result = run((m: string) => emitted.push(m), 7, { a: [1, 2] }, 'raw');
    expect(result).toBe(false);
    expect(emitted).toEqual(['n=7 obj={ a: [ 1, 2 ] } s=raw bad=<ReferenceError: missing is not defined>']);
  });

  it('logs only when the user condition holds, and reports a throwing condition without pausing', () => {
    const compiled = compileJsLogpoint({ logMessage: 'hit {n}', condition: 'n % 2 === 0' });
    if (!compiled.ok) {
      throw new Error(compiled.error);
    }
    const emitted: string[] = [];
    const run = new Function(JS_LOGPOINT_BINDING, 'n', `return (${compiled.condition});`);
    expect(run((m: string) => emitted.push(m), 3)).toBe(false);
    expect(emitted).toEqual([]);
    expect(run((m: string) => emitted.push(m), 4)).toBe(false);
    expect(emitted).toEqual(['hit 4']);

    const throwing = compileJsLogpoint({ logMessage: 'hit', condition: 'nope.x' });
    if (!throwing.ok) {
      throw new Error(throwing.error);
    }
    const errors: string[] = [];
    const runThrowing = new Function(JS_LOGPOINT_BINDING, `return (${throwing.condition});`);
    expect(runThrowing((m: string) => errors.push(m))).toBe(false);
    expect(errors).toEqual(['Logpoint condition error: ReferenceError: nope is not defined']);
  });

  describe('while the binding is not installed (issue #1212)', () => {
    const globals = globalThis as unknown as Record<string, unknown>;
    const compiledFor = (logMessage: string): string => {
      const compiled = compileJsLogpoint({ logMessage });
      if (!compiled.ok) {
        throw new Error(compiled.error);
      }
      return compiled.condition;
    };
    afterEach(() => {
      delete globals[JS_LOGPOINT_QUEUE];
      delete globals[JS_LOGPOINT_DROPPED];
    });

    it('keeps the message in the process, prints nothing, and still answers false', () => {
      const logged: unknown[] = [];
      const run = new Function('console', 'n', `return (${compiledFor('plain {n}')});`);
      expect(run({ log: (m: unknown) => logged.push(m) }, 1)).toBe(false);
      expect(run({ log: (m: unknown) => logged.push(m) }, 2)).toBe(false);
      expect(logged).toEqual([]);
      expect(globals[JS_LOGPOINT_QUEUE]).toEqual(['plain 1', 'plain 2']);
    });

    it('delivers what it kept first, in order, at the next hit that has the binding', () => {
      const condition = compiledFor('hit {n}');
      const unbound = new Function('n', `return (${condition});`);
      unbound(1);
      unbound(2);
      const emitted: string[] = [];
      const bound = new Function(JS_LOGPOINT_BINDING, 'n', `return (${condition});`);
      expect(bound((m: string) => emitted.push(m), 3)).toBe(false);
      expect(emitted).toEqual(['hit 1', 'hit 2', 'hit 3']);
      expect(globals[JS_LOGPOINT_QUEUE]).toEqual([]);
    });

    it('keeps a bounded number of messages and counts the rest', () => {
      const unbound = new Function('n', `return (${compiledFor('m{n}')});`);
      for (let n = 0; n < JS_LOGPOINT_QUEUE_LIMIT + 3; n++) {
        unbound(n);
      }
      expect((globals[JS_LOGPOINT_QUEUE] as unknown[]).length).toBe(JS_LOGPOINT_QUEUE_LIMIT);
      expect(globals[JS_LOGPOINT_DROPPED]).toBe(3);
    });

    it('the flush the proxy evaluates delivers the kept messages through the binding and answers the count that did not fit', () => {
      const unbound = new Function('n', `return (${compiledFor('m{n}')});`);
      unbound(1);
      unbound(2);
      globals[JS_LOGPOINT_DROPPED] = 4;
      const emitted: string[] = [];
      const flush = new Function(JS_LOGPOINT_BINDING, `return ${JS_LOGPOINT_FLUSH};`);
      expect(flush((m: string) => emitted.push(m))).toBe(4);
      expect(emitted).toEqual(['m1', 'm2']);
      expect(globals[JS_LOGPOINT_QUEUE]).toEqual([]);
      // Asked again, there is nothing left to deliver or to report.
      expect(flush((m: string) => emitted.push(m))).toBe(0);
      expect(emitted).toEqual(['m1', 'm2']);
      // Without the binding it delivers nothing and loses nothing.
      unbound(3);
      expect(new Function(`return ${JS_LOGPOINT_FLUSH};`)()).toBe(0);
      expect(globals[JS_LOGPOINT_QUEUE]).toEqual(['m3']);
    });
  });

  it('returns the validation error instead of a condition for a malformed message', () => {
    const compiled = compileJsLogpoint({ logMessage: 'n={n +}' });
    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error('expected failure');
    }
    expect(compiled.error).toMatch(/Unexpected token/);
  });
});
