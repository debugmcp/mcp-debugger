import { describe, it, expect } from 'vitest';
import {
  JS_LOGPOINT_BINDING,
  parseJsLogMessage,
  validateJsLogpoint,
  compileJsLogpoint
} from '../../../packages/shared/src/utils/js-logpoint.js';

/**
 * mcp-debugger compiles JavaScript logpoints itself (issues #850, #853, #861):
 * the wire form sent to js-debug is a breakpoint `condition` that evaluates
 * the user's condition, builds the message, hands it to the CDP binding the
 * proxy installs (falling back to console.log) and returns false.
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

  it('refuses an expression that would escape its wrapper (top-level ; or unbalanced brackets)', () => {
    expect(validateJsLogpoint('x={a; b}')).toMatch(/\{a; b\}/);
    expect(validateJsLogpoint('x={a) + (b}')).toMatch(/\{a\) \+ \(b\}/);
    expect(validateJsLogpoint('x={a) + (b}')).toMatch(/unbalanced|Unexpected token/);
  });
});

describe('compileJsLogpoint', () => {
  it('produces a deterministic condition that delivers through the binding, falls back to console.log and never pauses', () => {
    const first = compileJsLogpoint({ logMessage: 'n={n} done' });
    const second = compileJsLogpoint({ logMessage: 'n={n} done' });
    expect(first).toEqual(second);
    if (!first.ok) {
      throw new Error(first.error);
    }
    expect(first.condition).toContain(`typeof ${JS_LOGPOINT_BINDING} === 'function'`);
    expect(first.condition).toContain('console.log(');
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

  it('falls back to console.log when the binding is not installed', () => {
    const compiled = compileJsLogpoint({ logMessage: 'plain {1 + 1}' });
    if (!compiled.ok) {
      throw new Error(compiled.error);
    }
    const logged: unknown[] = [];
    const run = new Function('console', `return (${compiled.condition});`);
    expect(run({ log: (m: unknown) => logged.push(m) })).toBe(false);
    expect(logged).toEqual(['plain 2']);
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
