/**
 * Import-graph test for issue #400: stdio mode (and any mere import of the
 * entry point) must not evaluate the HTTP transport stacks. Express and the
 * SSE/HTTP command modules are only loaded when their subcommand actually runs.
 */
import { describe, it, expect, vi } from 'vitest';

const loaded = vi.hoisted(() => ({ express: false }));

// The factory only runs if something in the imported module graph actually
// imports express — that evaluation is exactly what this test forbids.
vi.mock('express', () => {
  loaded.express = true;
  return { default: vi.fn() };
});

describe('index.ts import graph (issue #400)', () => {
  it('does not evaluate express when the entry point is imported', async () => {
    // Importing the entry under vitest does not auto-run main(): argv[1] is
    // the worker, not dist/index.js, so its main-module check is false.
    await import('../../src/index.js');

    expect(loaded.express).toBe(false);
  });
});
