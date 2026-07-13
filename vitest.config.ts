import { defineConfig } from 'vitest/config';
import path from 'path';

// --- Shared Vite-level config -------------------------------------------------
// IMPORTANT: when `test.projects` is used, projects do NOT inherit the root
// `resolve`/`optimizeDeps`. These must be spread into every project (and we keep
// them at the root too so they apply to root-level operations like coverage).
const sharedResolve = {
  // Resolve TypeScript sources directly
  extensions: ['.ts', '.js', '.json', '.node'],
  alias: [
    // Map relative imports ending with .js to .ts (e.g., ../../../src/foo.js -> ../../../src/foo.ts)
    { find: /^(\.{1,2}\/.+)\.js$/, replacement: '$1.ts' },

    // Map absolute src imports ending with .js to .ts
    { find: /^(src\/.+)\.js$/, replacement: path.resolve(__dirname, './$1.ts') },

    // Keep project aliases pointing to TS sources
    { find: '@', replacement: path.resolve(__dirname, './src') },
    { find: '@debugmcp/shared', replacement: path.resolve(__dirname, './packages/shared/src/index.ts') },
    { find: '@debugmcp/adapter-mock', replacement: path.resolve(__dirname, './packages/adapter-mock/src/index.ts') },
    { find: '@debugmcp/adapter-python', replacement: path.resolve(__dirname, './packages/adapter-python/src/index.ts') },
    { find: '@debugmcp/adapter-ruby', replacement: path.resolve(__dirname, './packages/adapter-ruby/src/index.ts') },
    { find: '@debugmcp/adapter-javascript', replacement: path.resolve(__dirname, './packages/adapter-javascript/src/index.ts') },
    { find: '@debugmcp/adapter-go', replacement: path.resolve(__dirname, './packages/adapter-go/src/index.ts') },
    { find: '@debugmcp/adapter-rust', replacement: path.resolve(__dirname, './packages/adapter-rust/src/index.ts') },
    { find: '@debugmcp/adapter-java', replacement: path.resolve(__dirname, './packages/adapter-java/src/index.ts') },
    { find: '@debugmcp/adapter-dotnet', replacement: path.resolve(__dirname, './packages/adapter-dotnet/src/index.ts') }
  ]
};

// Handle ESM modules that need to be transformed
const sharedOptimizeDeps = {
  include: ['@modelcontextprotocol/sdk', '@vscode/debugprotocol']
};

// Shared test-level options (everything EXCEPT pool/parallelism/timeout, which
// differ between the parallel `unit` project and the serial `e2e` project).
const sharedSetupFiles = ['./tests/vitest.setup.ts'];

// Console filtering for noise reduction (identical behavior for both projects)
function onConsoleLog(log: string, type: 'stdout' | 'stderr'): boolean | void {
  // Whitelist - Always show important patterns
  const importantPatterns = [
    'FAIL',
    'Error:',
    'AssertionError',
    'Expected',
    'Received',
    'Test suite failed',
    'TypeError',
    'ReferenceError',
    '[Discovery Test]',
    '[Workflow Test]',
    '[Test Server]',
    '[env-utils]',
    '[process-listener-leak]'
  ];
  if (importantPatterns.some(pattern => log.includes(pattern))) {
    return true;
  }

  // Noise patterns to filter
  const noisePatterns = [
    'vite:',
    'webpack',
    '[HMR]',
    'Download the',
    'Debugger listening',
    'Waiting for the debugger',
    'Python path:',
    'spawn',
    '[esbuild]',
    'transforming',
    'node_modules',
    'has been externalized',
    '[MCP Server]',
    '[debug-mcp]',
    '[ProxyManager',
    '[SessionManager]',
    '[SM _updateSessionState',
    'stdout |',
    'stderr |',
    '20', // Date timestamps (matches 2025-, 2026-, etc.)
    '[info]',
    '[debug]',
    '[warn]'
  ];

  if (noisePatterns.some(pattern => log.includes(pattern))) {
    return false;
  }

  // In test files, allow user's console.log statements
  if (log.includes('.test.') || log.includes('.spec.')) {
    return true;
  }

  // Default: suppress stdout info/debug, keep stderr
  return type === 'stderr';
}

// Standard excludes (same for both projects)
const sharedExclude = [
  'node_modules',
  'dist',
  '**/node_modules/**',
  '**/dist/**'
];

// --- Test partition (3 projects) ----------------------------------------------
// Selection is done via `--project` (which works under Vitest 4 `projects`),
// NOT `--exclude` (which is silently ignored once `projects` is set). So every
// "run a subset" need maps to a project rather than an exclude glob:
//   - `unit`        : hermetic, parallel.
//   - `integration` : lighter process-spawning tests + (gated) stress, serial.
//   - `e2e`         : heavy smoke/docker/npx tests, serial.
// `--project unit --project integration` == "everything except tests/e2e/**",
// which is exactly what the old `--exclude '**/e2e/**'` CI scripts meant.

// Lighter process-spawning set. `tests/**/integration/**` captures
// tests/adapters/*/integration AND tests/integration/*. Stress self-gates on
// RUN_STRESS_TESTS (describe.skip otherwise), so it is harmless here by default.
const INTEGRATION_INCLUDE = [
  'tests/**/integration/**/*.{test,spec}.ts',
  'tests/stress/**/*.{test,spec}.ts'
];

// Heavy end-to-end set (spawns real servers, docker, npx packs).
const E2E_INCLUDE = ['tests/e2e/**/*.{test,spec}.ts'];

// Hermetic, millisecond-scale tests — safe to parallelize. Broad nets minus the
// two serial sets above, so newly-added hermetic dirs (e.g. tests/proxy) are
// picked up automatically rather than silently dropped.
const UNIT_INCLUDE = [
  'tests/**/*.{test,spec}.ts',
  'src/**/*.{test,spec}.ts',
  'packages/**/tests/**/*.{test,spec}.ts',
  'packages/**/src/**/*.{test,spec}.ts'
];
const UNIT_EXCLUDE = [...sharedExclude, ...INTEGRATION_INCLUDE, ...E2E_INCLUDE];

// Shared per-project test fields (everything except name/include/pool settings).
const sharedProjectTest = {
  globals: true,
  environment: 'node',
  setupFiles: sharedSetupFiles,
  onConsoleLog
};

// Serial pool settings for the process-spawning projects — identical to the
// previous whole-suite behavior (one file at a time, 30s timeout).
const serialPool = {
  pool: 'forks' as const,
  fileParallelism: false,
  maxWorkers: 1,
  isolate: true,
  testTimeout: 30000
};

export default defineConfig({
  // Kept at root too so alias/optimizeDeps apply to root-level resolution.
  resolve: sharedResolve,
  optimizeDeps: sharedOptimizeDeps,
  test: {
    // --- Root-level only (read by the top-level runner, not per project) ---
    // Tier 2: seeded random ordering to surface order-dependent tests. This MUST
    // live at the root — a per-project `sequence` is silently ignored under
    // `projects` (Vitest 4.1.8); the root value propagates to ALL projects, and
    // there is no per-project override. So it has to be safe for every project,
    // including the combined `--project unit --project integration` CI run.
    //
    // Therefore: FILES-ONLY here. `files: true` shuffles file order (catches
    // cross-file deps in the serial integration/e2e projects, harmless for the
    // isolated unit pool). `tests: false` because the integration/e2e suites
    // legitimately share a live debug session across `it` blocks (create→…→close)
    // and would break if tests were reordered within a file.
    //
    // Aggressive WITHIN-file shuffle (`tests: true`) — which is what catches a
    // unit test relying on a sibling's leftover mock/env state — is applied to the
    // unit project ALONE by the flake hunt (scripts/flake-hunt.mjs passes
    // `--sequence.shuffle.tests`), run via `pnpm run test:flake` and nightly CI.
    //
    // Seed is unpinned (defaults to Date.now()); reproduce a failure with
    // `vitest run --project <name> --sequence.seed=<n> [--sequence.shuffle.tests]`.
    sequence: { shuffle: { files: true, tests: false } },
    // Reporter configuration. On CI, 'json' (written from the main process, so
    // it survives a fork-worker death) records which file never reported —
    // attribution the dot reporter cannot give for pool errors (issue #159).
    reporters: process.env.CI ? ['dot', 'json'] : ['default'],
    outputFile: {
      json: './test-results.json'
    },
    // Coverage is a GLOBAL concern when using `projects` — it must live here at
    // the root. A per-project `coverage` block is silently ignored.
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'json', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      reportOnFailure: true,
      exclude: [
        'node_modules',
        'dist',
        'tests',
        'packages/**/tests',
        'src/proxy/proxy-bootstrap.js',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        // Type-only files - no executable code
        'src/container/types.ts',
        'src/dap-core/types.ts',
        // Mock adapter process - tested via e2e tests, runs as separate process
        'src/adapters/mock/mock-adapter-process.ts',
        'packages/adapter-mock/src/mock-adapter-process.ts',
        // CLI entry points - handle process-level stdio, not unit-testable
        'packages/mcp-debugger/src/cli-entry.ts',
        'packages/mcp-debugger/dist/packages/mcp-debugger/src/cli-entry.js',
        // Module init side-effects only (import statements that register adapters)
        'packages/mcp-debugger/src/batteries-included.ts',
        // Script entry point — process.argv parsing only, logic in netcoredbg-bridge-core.ts
        'packages/adapter-dotnet/src/utils/netcoredbg-bridge.ts',
        // Error definitions - mostly class constructors and type guards
        'src/errors/debug-errors.ts',
        // Proxy entry point - separate process
        'src/proxy/dap-proxy-entry.ts',
        // Factory pattern files with minimal logic
        'packages/shared/src/factories/adapter-factory.ts',
        // Exclude barrel export index files to prevent duplicate coverage
        'packages/shared/src/index.ts',
        'packages/shared/src/models/index.ts'
      ],
      include: ['src/**/*.{ts,js}', 'packages/**/src/**/*.{ts,js}'],
      thresholds: {
        statements: 80
      }
    },
    // --- Projects: parallel `unit` + serial `integration` + serial `e2e` ---
    projects: [
      {
        resolve: sharedResolve,
        optimizeDeps: sharedOptimizeDeps,
        test: {
          ...sharedProjectTest,
          name: 'unit',
          include: UNIT_INCLUDE,
          exclude: UNIT_EXCLUDE,
          // Parallel pool. Kept on `forks` for full per-file process isolation
          // (robust against any future non-hermetic test) — and it is also the
          // FASTER pool here. Tier 3 fake-timered the proxy init-retry backoff
          // tests that used to dominate the run (proxy-manager.start.test.ts /
          // child-session-manager.test.ts), dropping the unit suite from ~110s to
          // ~10s. A clean re-measure then put forks at ~10.5s vs threads ~12.3s
          // (147 files / 2283 tests); threads is green (Tier 2 made it safe) but
          // ~15% slower on this workload, so forks wins on speed AND isolation.
          pool: 'forks',
          fileParallelism: true,
          isolate: true,
          // 15s ceiling. The proxy retry/timeout paths now run on FAKE timers
          // (advanceTimersByTimeAsync) — no unit test burns real backoff — and the
          // whole suite runs in ~10s, so 15s leaves generous CI headroom while
          // failing a genuine hang far sooner than the old 30s.
          testTimeout: 15000
        }
      },
      {
        resolve: sharedResolve,
        optimizeDeps: sharedOptimizeDeps,
        test: {
          ...sharedProjectTest,
          ...serialPool,
          name: 'integration',
          include: INTEGRATION_INCLUDE,
          exclude: sharedExclude
        }
      },
      {
        resolve: sharedResolve,
        optimizeDeps: sharedOptimizeDeps,
        test: {
          ...sharedProjectTest,
          ...serialPool,
          name: 'e2e',
          include: E2E_INCLUDE,
          exclude: sharedExclude
        }
      }
    ]
  }
});
