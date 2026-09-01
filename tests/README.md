# Testing Guide

The project uses [Vitest](https://vitest.dev/) with tests organized into unit, integration, and E2E levels, plus stress tests, manual scripts, and validation helpers.

## Running Tests

### Core

```bash
npm test                  # Build + run all tests
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only
npm run test:e2e          # E2E tests (builds Docker image first)
npm run test:core         # Core system tests (tests/core/)
npm run test:watch        # Watch mode
npm run test:strict       # unit + integration with LEAK_GUARD_STRICT=1
npx vitest run path/to/file.test.ts  # Single file
```

### Language-Specific

```bash
npm run test:python       # Python adapter tests only
npm run test:no-python    # All tests except Python
```

### Distribution Channels

```bash
npm run test:e2e:smoke      # Language smoke tests (mcp-server-smoke-*.test.ts)
npm run test:e2e:container  # Docker container E2E (rebuilds image)
npm run test:e2e:npx        # NPX distribution E2E
npm run test:all-channels   # All three above in sequence
```

### CI

```bash
npm run test:ci             # All tests minus Docker
npm run test:ci-no-python   # No E2E, no Python
npm run test:ci-coverage    # Coverage without E2E
npm run test:no-docker      # Skip Docker tests
```

### Coverage

```bash
npm run test:coverage          # Full coverage (HTML report)
npm run test:coverage:summary  # Coverage summary table
npm run test:coverage:analyze  # Detailed analysis
npm run test:coverage:json     # JSON report
npm run test:coverage:quiet    # Minimal output
```

### Stress

```bash
npm run test:stress    # Stress and load tests (requires RUN_STRESS_TESTS=true)
```

### Output Formats

```bash
npm run test:verbose   # Detailed reporter
npm run test:quiet     # Minimal (dot + silent)
npm run test:dot       # Dot reporter
npm run test:json      # JSON results to test-results.json
```

### Type Checking

```bash
pnpm run typecheck               # tsc -p tsconfig.typecheck.json — src + packages/*/src, must be clean
pnpm run typecheck:tests         # ratchet the test trees against tests/typecheck-baseline.json
pnpm run typecheck:tests:raw     # raw tsc output for tsconfig.spec.json
pnpm run typecheck:tests:update  # re-record the baseline
pnpm run typecheck:all           # both — the exact command CI and pre-push run
```

See [The test-typing ratchet](#the-test-typing-ratchet) below for what the baseline is, and why
an uncommitted one blocks your push.

### Flake Hunting

```bash
npm run test:flake     # scripts/flake-hunt.mjs — repeat the unit project under fresh shuffle seeds
```

Every ordinary run already shuffles *file* order (`sequence.shuffle.files` in
`vitest.config.ts`). The flake hunt adds `--sequence.shuffle.tests` — the within-file shuffle
that catches a test relying on a sibling's leftover mock or env state — and prints an explicit
seed per run, so a failure reproduces with
`vitest run --project unit --sequence.seed=<n> --sequence.shuffle.tests`. It is unit-only on
purpose: the integration and e2e suites deliberately share a live debug session across `it`
blocks and would break if reordered within a file.

### GitHub Actions Locally (Act)

```bash
npm run act:test       # Run CI test job via Act
npm run act:full       # Full CI workflow via Act
```

## Directory Structure

```
tests/
├── adapters/                  # Per-language adapter tests
│   ├── go/unit/               # Go adapter unit tests
│   ├── go/integration/        # Go session smoke test
│   ├── java/unit/             # Java adapter, factory, utils, policy tests
│   ├── javascript/integration/# JavaScript session smoke test
│   ├── python/unit/           # Python utils tests
│   ├── python/integration/    # Python discovery and workflow tests
│   ├── ruby/unit/             # Ruby adapter policy tests
│   ├── ruby/integration/      # Ruby session smoke test
│   └── rust/integration/      # Rust session smoke test
│
├── core/unit/                 # Core system unit tests
│   ├── adapters/              # Debug adapter interface tests
│   ├── factories/             # ProxyManager and SessionStore factory tests
│   ├── server/                # MCP server tests (init, lifecycle, tools, language discovery)
│   ├── session/               # SessionManager tests (state, DAP, paths, edge cases, etc.)
│   └── utils/                 # Type guards, session migration
│
├── e2e/                       # End-to-end tests
│   ├── mcp-server-smoke-*.ts  # Per-language smoke tests (python, javascript, ruby, rust, go,
│   │                          #   java, dotnet, cpp) plus attach, function-breakpoint,
│   │                          #   SSE, restart and stale-reap variants
│   ├── docker/                # Docker container tests (python, javascript, rust, cpp,
│   │                          #   cpp-attach, ruby-attach, entrypoint)
│   └── npx/                   # NPX distribution tests (python, javascript, rust)
│
├── exploratory/               # Exploratory test result snapshots (JSON)
├── fixtures/                  # Test data
│   ├── adversarial-adapter/   # Scripted TCP DAP adapter that misbehaves on demand
│   ├── debug-scripts/         # Simple mock scripts
│   ├── javascript-e2e/        # JS/TS fixtures for E2E tests
│   └── python/                # Python debuggee scripts for attach/E2E tests
│
├── implementations/test/      # Fake implementations (e.g., fake-process-launcher.ts)
├── integration/rust/          # Rust cross-component integration tests
├── manual/                    # Manual/interactive test scripts (SSE, debugpy, js-debug)
│
├── proxy/                     # DAP proxy tests (worker, child sessions, client behavior)
├── stress/                    # Stress tests (SSE stress, cross-transport parity)
│
├── test-utils/                # Shared test utilities
│   ├── fakes/                 # Compile-checked fakes (classes that `implements` an interface)
│   ├── fixtures/              # Script fixtures (python-scripts.ts)
│   ├── helpers/               # Port manager, test dependencies, coverage tools
│   └── mocks/                 # Mock DAP client, logger, processes, adapters, etc.
│
├── tsconfig.json              # TS config for the test trees
├── typecheck-baseline.json    # Per-file test type-error ratchet (see below)
│
├── unit/                      # Main unit test directory
│   ├── adapter-python/        # Python debug adapter tests
│   ├── adapters/              # Adapter loader, registry, lease, JS/mock adapter tests
│   ├── changelog/             # Changelog fragment validation
│   ├── cli/                   # CLI command tests (stdio, sse, http, doctor, check-rust-binary,
│   │                          #   setup, version)
│   ├── container/             # Dependency injection tests
│   ├── dap-core/              # DAP handlers and state tests
│   ├── dev-proxy/             # Dev-proxy backend lifecycle, env and shutdown tests
│   ├── implementations/       # Process launcher, process manager, env, filesystem, network
│   ├── proxy/                 # Proxy manager, DAP proxy core, message parser, minimal-dap
│   ├── scripts/               # Repo tooling tests (the typecheck ratchet)
│   ├── shared/                # Adapter policy tests (contract, default, python, js, go,
│   │                          #   dotnet, mock) plus shared filesystem tests
│   ├── test-utils/            # Mock validation, fake-adapter conformance, test proxy manager
│   └── utils/                 # Error messages, logger, file checker, language config
│
├── validation/                # Validation scripts (e.g., debugpy breakpoint messages)
└── vitest.setup.ts            # Global Vitest setup
```

### Package Co-located Tests

Each adapter package also has tests alongside its source:

```
packages/
├── adapter-dotnet/tests/unit/     # .NET adapter, factory, utils, bridge tests
├── adapter-javascript/tests/unit/ # JS adapter, factory, config, resolver, vendor tests
├── adapter-mock/tests/unit/       # Mock adapter and factory tests
├── adapter-python/tests/unit/     # Python adapter, factory, utils tests
├── adapter-rust/tests/            # Rust adapter, binary detector, cargo utils tests
└── shared/tests/unit/             # Shared adapter policy tests
```

## Test Categories

**Unit tests** (`tests/unit/`, `tests/core/unit/`, `packages/*/tests/unit/`) test components in isolation with mocked dependencies. This is the largest category, covering adapters, CLI, DI container, DAP core, proxy, session manager, and utilities.

**Integration tests** (`tests/integration/`, `tests/adapters/*/integration/`) test interactions between components — e.g., a full debug session lifecycle through the adapter layer for a specific language.

**E2E tests** (`tests/e2e/`) run complete debugging workflows against real debug runtimes. Includes per-language smoke tests, Docker container tests, NPX distribution tests, and SSE transport tests.

**Proxy tests** (`tests/proxy/`) test the DAP proxy worker, child session manager, and DAP client behavior.

**Stress tests** (`tests/stress/`) test SSE connection handling under load and cross-transport parity. Gated behind `RUN_STRESS_TESTS=true`.

**Manual tests** (`tests/manual/`) are interactive scripts for ad-hoc debugging of SSE connections, debugpy, and js-debug transport.

**Validation tests** (`tests/validation/`) verify protocol-level correctness (e.g., debugpy breakpoint message formats).

## Shared Test Utilities

`tests/test-utils/` provides reusable infrastructure:

- **`fakes/fake-debug-adapter.ts`** — conformant `IDebugAdapter` double (see *Fakes vs mocks* below)
- **`helpers/port-manager.ts`** — allocates unique ports to avoid conflicts between parallel tests
- **`helpers/test-dependencies.ts`** — creates dependency injection containers pre-wired for testing
- **`mocks/dap-client.ts`** — mock DAP client for simulating debugger communication
- **`mocks/mock-logger.ts`** — captures log output for assertion
- **`mocks/mock-proxy-manager.ts`** — mock proxy manager with controllable behavior
- **`mocks/child-process.ts`**, **`mocks/net.ts`** — mock Node.js built-ins
- **`fixtures/python-scripts.ts`** — Python script content for test fixtures

### Fakes vs mocks

A **fake** (`test-utils/fakes/`) is a class that `implements` a production interface, so the
compiler rejects it the moment the interface moves — use one for the big behavioural interfaces
whose doubles otherwise drift, `IDebugAdapter` (`fakes/fake-debug-adapter.ts`) and `IProxyManager`
(`mocks/mock-proxy-manager.ts`, which predates the directory). A **mock** (`test-utils/mocks/`) is
a `vi.fn` bag for a narrow seam, where an untyped literal costs little and reads more directly.

Reach for a fake rather than hand-rolling an `as unknown as SomeInterface` literal: that cast
silences exactly the divergence the double exists to avoid.

## Writing Tests

**File naming**: Use `*.test.ts` or `*.spec.ts`. Both are picked up by Vitest.

**Where to add tests**:
- Adapter-specific unit tests → `packages/adapter-{lang}/tests/unit/` or `tests/adapters/{lang}/unit/`
- Core system tests → `tests/core/unit/{area}/`
- General unit tests → `tests/unit/{area}/`
- Integration tests → `tests/adapters/{lang}/integration/` or `tests/integration/`
- E2E tests → `tests/e2e/`

**Mock patterns**: Import from `tests/test-utils/mocks/` for standard mocks. Use `tests/unit/test-utils/auto-mock.ts` for auto-mock helpers.

**Test structure**: Use `describe`/`it` blocks. Arrange-act-assert pattern. Always `await` async operations.

## Configuration

Test configuration lives in `vitest.config.ts`, which defines **three projects**. Subsets are
selected with `--project`, not `--exclude` (which Vitest silently ignores once `projects` is
set), so `--project unit --project integration` means "everything except `tests/e2e/**`".

| Project | Include | Pool settings | Timeout |
|---|---|---|---|
| `unit` | the broad net below, minus the two sets that follow | `forks`, `fileParallelism: true`, no worker cap | 15 s |
| `integration` | `tests/**/integration/**`, `tests/stress/**` | `forks`, `fileParallelism: false`, `maxWorkers: 1` | 30 s |
| `e2e` | `tests/e2e/**` | `forks`, `fileParallelism: false`, `maxWorkers: 1` | 30 s |

Only the process-spawning projects run serially. The hermetic `unit` project — the large
majority of the suite — runs files in parallel.

- **Setup file**: `tests/vitest.setup.ts`
- **Coverage**: Istanbul provider, thresholds **enforced** at 90 % statements / 80 % branches
- **Include patterns** (the `unit` net; the `integration`/`e2e` sets are subtracted from it):
  `tests/**/*.{test,spec}.ts`, `src/**/*.{test,spec}.ts`,
  `packages/**/tests/**/*.{test,spec}.ts`, `packages/**/src/**/*.{test,spec}.ts`
- **File ordering**: seeded shuffle of file order on every run (`sequence.shuffle.files`);
  within-file shuffle is added only by `npm run test:flake`

## The test-typing ratchet

`tsconfig.spec.json` type-checks the test trees alongside the shipped sources. It does **not**
pass today — the suite carries a backlog of mock/type divergences — so
`scripts/typecheck-tests-ratchet.mjs` (`pnpm run typecheck:tests`) gates on the **per-file**
error count recorded in `tests/typecheck-baseline.json` rather than demanding zero. Per file,
not one total: a single number would let a new error hide behind an unrelated fix.

The ratchet fails in **both** directions:

- **A count went up** — you introduced type errors. Fix them.
- **A count went down, or a test file was removed** — that is progress, but the baseline is now
  stale. Run `pnpm run typecheck:tests:update` and commit `tests/typecheck-baseline.json` in
  the same change.

Two consequences worth knowing before you push:

- **Pre-push refuses to run** while `tests/typecheck-baseline.json` is modified but uncommitted.
  CI validates the *pushed commit*, not your working tree, so an uncommitted refresh would pass
  locally and fail in CI. `.husky/pre-push` checks this before it runs `typecheck:all`.
- If the ratchet cannot read the baseline at all (invalid JSON, the wrong shape, a path outside
  the test trees) it exits 2 and tells you to **delete the file first** — `--update` reads the
  baseline before writing one, so a corrupt file blocks its own repair.
