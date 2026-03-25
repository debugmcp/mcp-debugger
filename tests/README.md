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
│   ├── mcp-server-smoke-*.ts  # Per-language smoke tests (python, javascript, rust, go, java, dotnet)
│   ├── docker/                # Docker container tests (python, javascript, rust, entrypoint)
│   └── npx/                   # NPX distribution tests (python, javascript)
│
├── exploratory/               # Exploratory test result snapshots (JSON)
├── fixtures/                  # Test data
│   ├── debug-scripts/         # Simple mock scripts
│   └── javascript-e2e/        # JS/TS fixtures for E2E tests
│
├── implementations/test/      # Fake implementations (e.g., fake-process-launcher.ts)
├── integration/rust/          # Rust cross-component integration tests
├── manual/                    # Manual/interactive test scripts (SSE, debugpy, js-debug)
│
├── proxy/                     # DAP proxy tests (worker, child sessions, client behavior)
├── stress/                    # Stress tests (SSE stress, cross-transport parity)
│
├── test-utils/                # Shared test utilities
│   ├── fixtures/              # Script fixtures (python-scripts.ts)
│   ├── helpers/               # Port manager, test dependencies, coverage tools
│   └── mocks/                 # Mock DAP client, logger, processes, adapters, etc.
│
├── unit/                      # Main unit test directory
│   ├── adapter-python/        # Python debug adapter tests
│   ├── adapters/              # Adapter loader, registry, JS/mock adapter tests
│   ├── cli/                   # CLI command tests (stdio, sse, setup, version)
│   ├── container/             # Dependency injection tests
│   ├── dap-core/              # DAP handlers and state tests
│   ├── implementations/       # Process launcher, process manager, env, filesystem, network
│   ├── proxy/                 # Proxy manager, DAP proxy core, message parser, minimal-dap
│   ├── shared/                # Adapter policy tests (default, python, js, go, dotnet, mock)
│   ├── test-utils/            # Mock validation, test proxy manager
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

- **`helpers/port-manager.ts`** — allocates unique ports to avoid conflicts between parallel tests
- **`helpers/test-dependencies.ts`** — creates dependency injection containers pre-wired for testing
- **`mocks/dap-client.ts`** — mock DAP client for simulating debugger communication
- **`mocks/mock-logger.ts`** — captures log output for assertion
- **`mocks/mock-proxy-manager.ts`** — mock proxy manager with controllable behavior
- **`mocks/child-process.ts`**, **`mocks/net.ts`** — mock Node.js built-ins
- **`fixtures/python-scripts.ts`** — Python script content for test fixtures

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

Test configuration lives in `vitest.config.ts`:

- **Setup file**: `tests/vitest.setup.ts`
- **Test timeout**: 30 seconds
- **Max workers**: 1 (process-spawning tests require serial execution)
- **File parallelism**: Disabled
- **Coverage**: Istanbul provider
- **Include patterns**: `tests/**/*.{test,spec}.ts`, `packages/**/tests/**/*.{test,spec}.ts`
