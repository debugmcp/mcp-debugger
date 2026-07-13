/**
 * Vitest Setup File
 * 
 * This file is run before each test file and is used to:
 * - Configure global test settings
 * - Set up global mocks
 * - Initialize test environments
 */
import { vi, beforeAll, afterEach, afterAll, expect } from 'vitest';
import { portManager } from './test-utils/helpers/port-manager.js';

/** Best-effort path of the test file currently running (empty outside a test). */
function currentTestPath(): string {
  try {
    return expect.getState().testPath ?? '';
  } catch {
    return '';
  }
}

// Surface unhandled rejections/exceptions during tests with concise messages
process.on('unhandledRejection', (reason) => {
  const at = currentTestPath();
  console.error(
    '[Test] UnhandledRejection:',
    reason instanceof Error ? reason.message : reason,
    at ? `(file: ${at})` : ''
  );
});
process.on('uncaughtException', (err) => {
  const at = currentTestPath();
  console.error(
    '[Test] UncaughtException:',
    err instanceof Error ? err.message : err,
    at ? `(file: ${at})` : ''
  );
});

// Ensure console silencing is disabled in unit tests unless explicitly set
delete process.env.CONSOLE_OUTPUT_SILENCED;

// Add type declarations for global test helpers
declare global {
  // eslint-disable-next-line no-var
  var __dirname: string;
  // eslint-disable-next-line no-var
  var testPortManager: typeof portManager;
}

// Make __dirname available in ESM context
(globalThis as any).__dirname = import.meta.url
  ? new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)\//, '$1/')  // For Windows paths
  : process.cwd();

// For Windows, clean up the path format
if (process.platform === 'win32' && (globalThis as any).__dirname) {
  (globalThis as any).__dirname = (globalThis as any).__dirname.replace(/\//g, '\\');
}

// Make port manager available globally
(globalThis as any).testPortManager = portManager;

// Reset test states before each test file
beforeAll(() => {
  // Timeout is set in vitest.config.ts
  portManager.reset();
});

// --- process-listener leak guard (issue #159) -------------------------------
// Tests that attach real listeners to the fork worker's `process` and never
// remove them can hard-kill the worker: a leaked uncaughtException handler
// whose mocks were reset throws inside the handler (fatal), and leaked
// handlers around exit-bearing production paths call the real process.exit().
// Vitest then reports "[vitest-pool]: Worker exited unexpectedly" with the
// file's results lost — a red CI run over a fully green suite.
//
// 'warning' is deliberately not guarded: src/index.ts installs a module-level
// noop 'warning' listener on import, which would trip the guard benignly.
const GUARDED_PROCESS_EVENTS = [
  'uncaughtException',
  'unhandledRejection',
  'SIGTERM',
  'SIGINT',
  'message',
  'disconnect',
  'error',
  'exit'
] as const;

type ProcessListener = (...args: unknown[]) => void;

// Baseline includes vitest/tinypool worker plumbing (installed before setup
// files run) and this file's diagnostic handlers (registered above).
const processListenerBaseline = new Map<string, Set<ProcessListener>>(
  GUARDED_PROCESS_EVENTS.map((event) => [
    event,
    new Set(process.rawListeners(event) as ProcessListener[])
  ])
);

// Registered BEFORE the mock-reset afterEach below: vitest's sequence.hooks
// defaults to 'stack' (LIFO), so this hook runs LAST — after file-local
// afterEach cleanup AND after restoreAllMocks (any process.on spies are gone).
afterEach(() => {
  const leaked: string[] = [];
  for (const event of GUARDED_PROCESS_EVENTS) {
    const evt: string = event;
    const baseline = processListenerBaseline.get(evt) ?? new Set<ProcessListener>();
    for (const listener of process.rawListeners(evt) as ProcessListener[]) {
      if (!baseline.has(listener)) {
        process.removeListener(evt, listener);
        leaked.push(evt);
      }
    }
  }
  if (leaked.length > 0) {
    const state = expect.getState();
    console.error(
      `[process-listener-leak] Removed leaked '${leaked.join("', '")}' listener(s) left by ` +
        `"${state.currentTestName ?? 'unknown test'}" (${state.testPath ?? 'unknown file'}). ` +
        `Leaked process listeners can hard-kill the vitest fork worker (issue #159): ` +
        `capture handlers with mockImplementation instead of attaching them, or remove them in afterEach.`
    );
    if (process.env.LEAK_GUARD_STRICT) {
      throw new Error(`[process-listener-leak] leaked listener(s): ${leaked.join(', ')}`);
    }
  }
});

// Reset test states after each test
afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
  // Auto-restore any env vars set via vi.stubEnv(), so tests that adopt stubEnv
  // are cleaned up centrally and can't leak process.env across tests/files. This
  // is the prerequisite for migrating ad-hoc `process.env.X = …` save/restore to
  // vi.stubEnv (and, ultimately, for running the unit pool on threads). No-op for
  // tests that still mutate process.env directly.
  vi.unstubAllEnvs();
});

// Clean up after all tests
afterAll(async () => {
  portManager.reset();
  
  // session-helpers.ts (shared test server) was removed as dead code —
  // no test file ever imported it, so the singleton was never created.
});
