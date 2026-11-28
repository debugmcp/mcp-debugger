/**
 * A minimal Vitest config for the state-shadow harness fixtures, run in a
 * child process by tests/unit/session/machine/strict-harness.test.ts. It uses
 * the real setup file (tests/vitest.setup.ts) in strict mode, and nothing else
 * of the project's configuration.
 */
import { defineConfig } from 'vitest/config';
import os from 'os';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../..');

export default defineConfig({
  root: __dirname,
  cacheDir: path.join(os.tmpdir(), 'mcp-debugger-state-shadow-harness-cache'),
  resolve: {
    extensions: ['.ts', '.js', '.json'],
    alias: [
      { find: /^(\.{1,2}\/.+)\.js$/, replacement: '$1.ts' },
      { find: '@debugmcp/shared', replacement: path.join(ROOT, 'packages/shared/src/index.ts') }
    ]
  },
  test: {
    include: ['*.fixture.ts'],
    setupFiles: [path.join(ROOT, 'tests/vitest.setup.ts')],
    env: { MCP_STATE_SHADOW: 'strict' },
    pool: 'forks',
    fileParallelism: false,
    sequence: { shuffle: false },
    testTimeout: 15000
  }
});
