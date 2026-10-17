/**
 * The entry prologue (issue #732): the one module both entries — `src/index.ts`
 * and the bundled `cli-entry.ts` — import first, so the console is silenced
 * and argv is normalised before any other module evaluates. It used to be
 * inline in `src/index.ts`, which the bundle reached only through a dynamic
 * import guarded by an env flag.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const CONSOLE_METHODS = [
  'log', 'error', 'warn', 'info', 'debug', 'trace', 'dir', 'table', 'group', 'groupEnd', 'time', 'timeEnd', 'assert'
] as const;

describe('src/cli/entry-prologue.ts (issue #732)', () => {
  const originals = new Map<string, unknown>();
  let originalArgv: string[];
  let originalSilenced: string | undefined;

  beforeEach(() => {
    vi.resetModules();
    originalArgv = process.argv;
    originalSilenced = process.env.CONSOLE_OUTPUT_SILENCED;
    for (const method of CONSOLE_METHODS) originals.set(method, console[method]);
  });

  afterEach(() => {
    process.argv = originalArgv;
    if (originalSilenced === undefined) delete process.env.CONSOLE_OUTPUT_SILENCED;
    else process.env.CONSOLE_OUTPUT_SILENCED = originalSilenced;
    for (const method of CONSOLE_METHODS) {
      (console as unknown as Record<string, unknown>)[method] = originals.get(method);
    }
  });

  it('silences every console method and marks the environment on import', async () => {
    delete process.env.CONSOLE_OUTPUT_SILENCED;

    await import('../../../src/cli/entry-prologue.js');

    expect(process.env.CONSOLE_OUTPUT_SILENCED).toBe('1');
    for (const method of CONSOLE_METHODS) {
      expect(console[method], method).not.toBe(originals.get(method));
      expect((console[method] as (...args: unknown[]) => unknown)('must not reach stdout'), method).toBeUndefined();
    }
  });

  it('strips a quoted argument down to its content', async () => {
    process.argv = [process.execPath, 'index.js', '"stdio"', "'--log-level'", 'plain', '"unbalanced'];

    await import('../../../src/cli/entry-prologue.js');

    expect(process.argv.slice(2)).toEqual(['stdio', '--log-level', 'plain', '"unbalanced']);
  });
});
