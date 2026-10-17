/**
 * `src/main.ts` is the side-effect-free home of `main()` (issue #732): the
 * bundled CLI imports it directly, so it must neither start a server nor touch
 * the console on import — the entry prologue (`src/cli/entry-prologue.ts`) does
 * the silencing, and only the real entries (`src/index.ts`, `cli-entry.ts`)
 * import that.
 */
import { describe, it, expect } from 'vitest';

describe('src/main.ts (issue #732)', () => {
  it('exports main() and createDebugMcpServer() without silencing the console on import', async () => {
    const originalLog = console.log;
    const originalError = console.error;

    const loaded = await import('../../src/main.js');

    expect(typeof loaded.main).toBe('function');
    expect(typeof loaded.createDebugMcpServer).toBe('function');
    expect(console.log).toBe(originalLog);
    expect(console.error).toBe(originalError);
    expect(process.env.CONSOLE_OUTPUT_SILENCED).toBeUndefined();
  });
});
