import { describe, it, expect, afterEach } from 'vitest';
import vm from 'node:vm';
import {
  JS_LOGPOINT_BINDING,
  JS_LOGPOINT_CLEAR,
  JS_LOGPOINT_DROPPED,
  JS_LOGPOINT_FLUSH,
  JS_LOGPOINT_QUEUE,
  JS_LOGPOINT_QUEUE_CHARS,
  JS_LOGPOINT_QUEUE_LIMIT,
  JS_LOGPOINT_UNBIND,
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
    /** The kept messages (the queue is an array with a running character count on it). */
    const kept = (): string[] => [...((globals[JS_LOGPOINT_QUEUE] as string[] | undefined) ?? [])];
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
      expect(kept()).toEqual(['plain 1', 'plain 2']);
    });

    it('keeps them out of the program\'s sight: neither global is enumerable, and the proxy\'s clear deletes both', () => {
      const unbound = new Function('n', `return (${compiledFor('m{n}')});`);
      for (let n = 0; n < JS_LOGPOINT_QUEUE_LIMIT + 1; n++) {
        unbound(n);
      }
      expect(JS_LOGPOINT_QUEUE in globals).toBe(true);
      expect(JS_LOGPOINT_DROPPED in globals).toBe(true);
      // What a global-leak check reads (mocha --check-leaks, jest).
      expect(Object.keys(globalThis)).not.toContain(JS_LOGPOINT_QUEUE);
      expect(Object.keys(globalThis)).not.toContain(JS_LOGPOINT_DROPPED);

      expect(new Function(`return ${JS_LOGPOINT_CLEAR};`)()).toBe(0);

      expect(JS_LOGPOINT_QUEUE in globals).toBe(false);
      expect(JS_LOGPOINT_DROPPED in globals).toBe(false);
      // Cleared, a later hit starts over.
      unbound(7);
      expect(kept()).toEqual(['m7']);
    });

    it("takes the binding's function out of the process, which Runtime.removeBinding does not: a later hit is kept again", () => {
      // Measured on Node 24: after Runtime.removeBinding the function is still a
      // property of the global object, and a call to it reaches nobody.
      globals[JS_LOGPOINT_BINDING] = () => undefined;
      const hit = new Function('n', `return (${compiledFor('m{n}')});`);
      try {
        hit(1);
        expect(kept()).toEqual([]);

        expect(new Function(`return ${JS_LOGPOINT_UNBIND};`)()).toBe(true);

        expect(JS_LOGPOINT_BINDING in globals).toBe(false);
        hit(2);
        expect(kept()).toEqual(['m2']);
        // Asked again with nothing there, it still answers that the function is gone.
        expect(new Function(`return ${JS_LOGPOINT_UNBIND};`)()).toBe(true);
      } finally {
        delete globals[JS_LOGPOINT_BINDING];
      }
    });

    it('answers that the function is still there when the program made it impossible to remove', () => {
      // In a context of its own: a property that cannot be removed would stay in this process for good.
      const context = vm.createContext({});
      vm.runInContext(
        `Object.defineProperty(globalThis, '${JS_LOGPOINT_BINDING}', { value: () => undefined, configurable: false });`,
        context
      );

      expect(vm.runInContext(JS_LOGPOINT_UNBIND, context)).toBe(false);
      // The clear does not throw on it either.
      expect(vm.runInContext(JS_LOGPOINT_CLEAR, context)).toBe(0);
      // And where it can be removed, the same context answers yes.
      const free = vm.createContext({});
      vm.runInContext(`globalThis.${JS_LOGPOINT_BINDING} = () => undefined;`, free);
      expect(vm.runInContext(JS_LOGPOINT_UNBIND, free)).toBe(true);
    });

    it("the clear the proxy evaluates when it lets go leaves neither the kept messages nor the binding's function", () => {
      globals[JS_LOGPOINT_BINDING] = () => undefined;
      globals[JS_LOGPOINT_QUEUE] = ['left over'];
      globals[JS_LOGPOINT_DROPPED] = 2;
      try {
        expect(new Function(`return ${JS_LOGPOINT_CLEAR};`)()).toBe(0);
        expect(JS_LOGPOINT_BINDING in globals).toBe(false);
        expect(JS_LOGPOINT_QUEUE in globals).toBe(false);
        expect(JS_LOGPOINT_DROPPED in globals).toBe(false);
      } finally {
        delete globals[JS_LOGPOINT_BINDING];
      }
    });

    it('a hit that delivers the kept messages gives the character budget back', () => {
      const condition = compiledFor('{s}');
      const unbound = new Function('s', `return (${condition});`);
      const big = 'x'.repeat(JS_LOGPOINT_QUEUE_CHARS / 2);
      unbound(big);
      unbound(big);
      // Delivered by a hit, not by the proxy's flush.
      new Function(JS_LOGPOINT_BINDING, 's', `return (${condition});`)(() => undefined, 'now');

      unbound(big);
      unbound(big);

      expect(kept()).toHaveLength(2);
      expect(globals[JS_LOGPOINT_DROPPED]).toBeUndefined();
    });

    it('never throws out of the condition: js-debug reports a throwing condition on the program\'s stderr', () => {
      // The global object cannot take the queue, or `globalThis` is shadowed where the logpoint sits.
      const frozen = new Function('globalThis', 'n', `return (${compiledFor('m{n}')});`);
      expect(frozen(Object.freeze({}), 1)).toBe(false);
      expect(frozen(null, 2)).toBe(false);
      expect(frozen(undefined, 3)).toBe(false);
      expect(kept()).toEqual([]);

      // With the binding in, the message is delivered whatever the queue did.
      const emitted: string[] = [];
      const shadowed = new Function(JS_LOGPOINT_BINDING, 'globalThis', 'n', `return (${compiledFor('m{n}')});`);
      expect(shadowed((m: string) => emitted.push(m), null, 4)).toBe(false);
      expect(emitted).toEqual(['m4']);

      // Even if user code replaces the binding with a throwing function, the condition still never throws.
      expect(
        shadowed(
          () => {
            throw new Error('shadowed binding threw');
          },
          null,
          5
        )
      ).toBe(false);
    });

    it('keeps a bounded number of characters too, and counts what did not fit', () => {
      const unbound = new Function('s', `return (${compiledFor('{s}')});`);
      const big = 'x'.repeat(JS_LOGPOINT_QUEUE_CHARS / 4);
      for (let i = 0; i < 6; i++) {
        unbound(big);
      }
      expect(kept()).toHaveLength(4);
      expect(globals[JS_LOGPOINT_DROPPED]).toBe(2);
      // Delivered, the budget is whole again.
      const emitted: string[] = [];
      new Function(JS_LOGPOINT_BINDING, `return ${JS_LOGPOINT_FLUSH};`)((m: string) => emitted.push(m));
      expect(emitted).toHaveLength(4);
      unbound(big);
      expect(kept()).toHaveLength(1);
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
      expect(kept()).toEqual([]);
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
      expect(kept()).toEqual([]);
      // Asked again, there is nothing left to deliver or to report.
      expect(flush((m: string) => emitted.push(m))).toBe(0);
      expect(emitted).toEqual(['m1', 'm2']);
      // Without the binding it delivers nothing and loses nothing.
      unbound(3);
      expect(new Function(`return ${JS_LOGPOINT_FLUSH};`)()).toBe(0);
      expect(kept()).toEqual(['m3']);
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
