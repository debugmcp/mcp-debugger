# Testing Architecture

This document explains the **design decisions and mechanisms** behind the mcp-debugger test suite. For directory layout, test commands, and file placement guidance, see [`tests/README.md`](../../tests/README.md).

The subject is a multi-process, multi-language debug server that spawns real OS processes, connects to real debug adapters via DAP, and communicates over JSON-RPC. Two quality gates hold it: an **enforced** coverage floor (90% statements / 80% branches — see [Coverage Strategy](#coverage-strategy)) and a **type-error ratchet** over the test trees themselves (see [Type Checking the Test Suite](#type-checking-the-test-suite)). The suite is organized into seven categories: unit, integration, E2E, proxy, stress, manual, and validation.

## Testing Philosophy

### Three-Level Testing Model

**Unit tests** verify components in isolation with mocked dependencies. This is the largest category. Every adapter, session manager method, proxy component, DI container, DAP handler, and utility function has unit coverage. Mocks substitute all external interfaces so each test exercises exactly one unit of logic.

**Integration tests** verify component interactions with real (or near-real) implementations. Per-language adapter integration tests exercise the full create-breakpoint-start-inspect-step-close path through the adapter layer, confirming that the adapter, proxy, and session manager cooperate correctly for a specific language runtime.

**E2E tests** verify complete user-visible workflows against real debug runtimes. They spawn the MCP server as a subprocess, connect a real MCP SDK client over JSON-RPC, call tools, and verify the debug adapter produces correct results. Nothing is mocked except the user.

### Isolation Strategy

The server spawns OS processes (proxy workers, debug adapters) that bind ports and consume system resources. Test files that spawn those processes in parallel would compete for ports, leave orphans, and produce flaky failures. But that hazard belongs to the tests that actually spawn — which is a minority of the suite. So the isolation cost is paid **per project**, not suite-wide: `vitest.config.ts` splits the suite into three Vitest projects, selected with `--project`.

| Project | What is in it | Pool settings | `testTimeout` |
|---|---|---|---|
| `unit` | hermetic, millisecond-scale tests — the broad include net minus the two sets below | `pool: 'forks'`, **`fileParallelism: true`**, `isolate: true`, no `maxWorkers` cap | 15 000 |
| `integration` | `tests/**/integration/**` plus `tests/stress/**` | `pool: 'forks'`, `fileParallelism: false`, `maxWorkers: 1` | 30 000 |
| `e2e` | `tests/e2e/**` (smoke, docker, npx) | `pool: 'forks'`, `fileParallelism: false`, `maxWorkers: 1` | 30 000 |

Two rationales, one per side of the split:

- **The serial projects** keep the original trade-off: slower, but they eliminate a class of non-deterministic failure that is nearly impossible to debug in CI. Their 30 s ceiling is a safety net for hung processes.
- **The parallel `unit` project** got there by removing the reason to be serial rather than by accepting the risk. The proxy init-retry and timeout paths were moved onto fake timers (`advanceTimersByTimeAsync`), so no unit test burns real backoff; the config records the unit suite dropping from ~110 s to ~10 s. `forks` is kept over `threads` for full per-file process isolation *and* because a clean re-measure put it ahead on speed (~10.5 s vs ~12.3 s). With the wall clock down to ~10 s, the 15 s ceiling fails a genuine hang far sooner than the old 30 s would.

Selection is by `--project`, never by `--exclude` — Vitest silently ignores exclude globs once `projects` is set. `--project unit --project integration` is therefore the modern spelling of "everything except `tests/e2e/**`" — used directly by `test:strict` and `test:ci-coverage`, and reached the long way round by `.husky/pre-push`, which runs `test:unit` and `test:integration` back to back over the same set.

### Test Ordering and the Flake Hunt

Every run shuffles **file** order under a seed (`sequence.shuffle.files`, defaulting to `Date.now()`), which surfaces cross-file order dependencies in the serial projects and is harmless in the isolated unit pool. `sequence` must live at the **root** of the config — a per-project `sequence` is silently ignored under `projects` (Vitest 4.1.8) and the root value propagates to every project with no override — so the committed setting has to be safe for all three. Hence files-only: `tests: false`, because the integration and e2e suites legitimately share one live debug session across `it` blocks (create → … → close) and would break if reordered within a file.

The aggressive **within-file** shuffle — what actually catches a unit test leaning on a sibling's leftover mock or env state — is applied to the `unit` project alone, by `scripts/flake-hunt.mjs` (`pnpm run test:flake`). It loops the project under fresh explicit seeds, prints each one, and exits non-zero listing the failing seeds. Any failure reproduces exactly with:

```bash
vitest run --project unit --sequence.seed=<seed> --sequence.shuffle.tests
```

## Test Infrastructure

### Vitest Configuration

**File:** `vitest.config.ts`

Key settings beyond the isolation strategy above. Note that `coverage` and `sequence` are **global** concerns under `projects` — a per-project block for either is silently ignored — while `resolve`/`optimizeDeps` are the opposite: projects do *not* inherit them from the root, so they are spread into each one.

- **Coverage**: Istanbul provider with four reporters (`text`, `json`, `html`, `json-summary`). `reportOnFailure: true` captures partial coverage even when tests fail.
- **Console filtering**: `onConsoleLog` whitelists important patterns (FAIL, Error, AssertionError, TypeError) and suppresses noise from the server's own logging (timestamps, log levels, MCP Server messages, proxy output). Default behavior: suppress stdout, keep stderr. This keeps test output readable when server components emit verbose logs.
- **CI reporter**: dot reporter when `process.env.CI` is set; default reporter locally.
- **Resolve aliases**: `@debugmcp/*` workspace packages map to their TypeScript sources so Vitest can import package code directly without a build step. A `.js` → `.ts` rewrite alias handles ESM import paths.
- **Include patterns**: `tests/**/*.{test,spec}.ts`, `src/**/*.{test,spec}.ts`, `packages/**/tests/**/*.{test,spec}.ts`, `packages/**/src/**/*.{test,spec}.ts`.

### Setup File

**File:** `tests/vitest.setup.ts`

Runs before each test file:

1. Installs `unhandledRejection` and `uncaughtException` listeners that print concise one-line messages instead of letting Node crash with stack dumps.
2. Deletes `process.env.CONSOLE_OUTPUT_SILENCED` so unit tests see console output (production silences console to protect stdio transport).
3. Computes `__dirname` for ESM context with Windows path normalization.
4. Makes `portManager` globally available as `globalThis.testPortManager`.
5. **`beforeAll`**: resets port manager allocations.
6. **`afterEach`**: calls `vi.resetAllMocks()`, `vi.restoreAllMocks()`, and `vi.unstubAllEnvs()` to guarantee a clean slate per test.
7. **`afterEach` (process-listener leak guard)**: compares `process.rawListeners` for guarded process events against a baseline captured at setup, removing and reporting any listeners a test leaked (throws instead when `LEAK_GUARD_STRICT` is set).
8. **`afterAll`**: resets port manager.

### Port Allocation

**File:** `tests/test-utils/helpers/port-manager.ts`

Three non-overlapping 100-port ranges anchored at base port 5679:

| Range | Enum Value | Ports |
|-------|-----------|-------|
| `UNIT_TESTS` | 0 | 5679–5778 |
| `INTEGRATION` | 100 | 5779–5878 |
| `E2E` | 200 | 5879–5978 |

The singleton `portManager` tracks allocations in an in-process `Set<number>`. This does not guarantee OS-level availability — another process could occupy the same port — but prevents tests within the same Vitest worker from colliding. Methods: `getPort(range)`, `getPorts(count, range)`, `releasePort(port)`, `isPortInUse(port)`, `reset()`.

## Mock Architecture

The project maintains three kinds of test double, in three places:

- **Mocks** (`tests/test-utils/mocks/`) — `vi.fn()`-based objects for call tracking and assertion. Answer: "was this method called with these arguments?"
- **Functional fakes** (`tests/implementations/test/`) — lightweight implementations with deterministic behavior. Answer: "given this input, does the system produce the right output?"
- **Compile-checked fakes** (`tests/test-utils/fakes/`) — classes that `implements` a production interface, so the *compiler* rejects them the moment the interface moves.

### Compile-Checked Fakes

**File:** `tests/test-utils/fakes/fake-debug-adapter.ts`

`FakeDebugAdapter` is the single conformant `IDebugAdapter` double. It exists because the suite used to hand-roll ~40 object literals shaped like a debug adapter and force each through `as unknown as IDebugAdapter` — a cast that silences exactly the divergence the double exists to catch. The literals duly drifted: a *synchronous* `transformLaunchConfig` (the interface returns a Promise), two members that no longer existed on the interface, and fifteen stubbed EventEmitter methods that never emitted anything.

Two rules make it useful beyond "it compiles":

- Every **required** member is a `vi.fn` with a production-shaped default, so a test states only the behavior it cares about and can still assert on the rest.
- Every **optional** member is **absent** unless opted in (`withAttachSupport()`, `withLaunchBarrier()`). Production guards them (`adapter.supportsAttach?.()`), and a double that always defined them would only ever exercise one side of that branch.

`tests/unit/test-utils/fake-debug-adapter.test.ts` pins that contract. `MockProxyManager` (`mocks/mock-proxy-manager.ts`) is the same idea for `IProxyManager` and predates the directory. The rule of thumb: reach for a fake for the big behavioral interfaces whose doubles otherwise drift, and for a `vi.fn` mock at a narrow seam where an untyped literal costs little and reads more directly. See [`tests/README.md`](../../tests/README.md) — *Fakes vs mocks*.

### The createMockDependencies() Pattern

**File:** `tests/test-utils/helpers/test-dependencies.ts`

`createMockDependencies()` creates a complete DI container (matching the `Dependencies` interface) with all methods as `vi.fn()` mocks: `fileSystem`, `processManager`, `networkManager`, `logger`, `proxyProcessLauncher`, `proxyManagerFactory`, `sessionStoreFactory`. This is the standard entry point for unit tests that exercise `SessionManager` or the server layer.

Individual helpers are also exported for narrower tests: `createMockLogger()`, `createMockFileSystem()`, `createMockProcessManager()`, `createMockNetworkManager()`, `createMockEnvironment()`.

A parallel `createMockDependencies()` in `tests/core/unit/session/session-manager-test-utils.ts` provides a SessionManager-specific variant with additional `vi.mock()` setup for transitive dependencies.

### Mock Objects

All in `tests/test-utils/mocks/`:

**`MockProxyManager`** (`mock-proxy-manager.ts`) — extends `EventEmitter`, implements `IProxyManager`. The central mock for testing session and server logic. Features:

- Call tracking arrays: `startCalls[]`, `stopCalls` (count), `dapRequestCalls[]`
- Controllable behavior: `shouldFailStart`, `startDelay`, `shouldFailDapRequests`, `dapRequestDelay`
- Canned DAP responses for common commands: `setBreakpoints`, `stackTrace`, `scopes`, `variables`, step operations, `continue`
- Custom DAP handler: `setDapRequestHandler(fn)` for per-test response logic
- Event simulation: `simulateStopped(threadId, reason)`, `simulateEvent(event, ...args)`, `simulateError(error)`, `simulateExit(code, signal)`
- `reset()` clears all state, call history, and listeners

**`MockAdapterRegistry`** (`mock-adapter-registry.ts`) — three factory variants:

- `createMockAdapterRegistry()`: default registry with python + mock language support and realistic `AdapterInfo` map
- `createMockAdapterRegistryWithErrors()`: all calls fail, no languages supported
- `createMockAdapterRegistryWithLanguages(languages)`: custom language set with auto-generated `AdapterInfo`

Each returns a full `IAdapterRegistry` with `vi.fn()` methods. Helper functions: `expectAdapterRegistryLanguageCheck()`, `expectAdapterCreation()`, `resetAdapterRegistryMock()`.

**`MockDapClient`** (`dap-client.ts`) — extends `EventEmitter`. Per-command response/error maps via `mockRequest(cmd, response)` and `simulateRequestError(cmd, error)`. `simulateEvent(event, data)` triggers DAP events (`initialized`, `stopped`, `continued`, `exited`, `terminated`, `output`, `breakpoint`, etc.).

**`MockChildProcess` / `ChildProcessMock`** (`child-process.ts`) — `MockChildProcess` extends `EventEmitter` with `kill`, `send`, `pid`, `killed`, and streams. Helpers: `simulateExit()`, `simulateError()`, `simulateStdout()`, `simulateStderr()`, `simulateMessage()`. The outer `ChildProcessMock` wraps `spawn`, `exec`, `execSync`, `fork` with domain-specific setup methods: `setupPythonSpawnMock()`, `setupPythonVersionCheckMock()`, `setupProxySpawnMock()`.

**Other mocks**: `createMockLogger()` (simple `vi.fn()` stubs for `info`/`error`/`debug`/`warn`), `MockCommandFinder` (per-command path mappings with call history), `createEnvironmentMock()` (defaults `MCP_CONTAINER` to `'false'` for host mode), minimal `fs-extra` and `net` mocks.

### Fake Implementations

**File:** `tests/implementations/test/fake-process-launcher.ts`

**`FakeProcess`** — extends `EventEmitter`, implements `IProcess`. Has real `PassThrough` streams for stdin/stdout/stderr and a deterministic `pid` (12345). Test helpers: `simulateOutput()`, `simulateError()`, `simulateExit()`, `simulateSpawn()`, `simulateProcessError()`, `simulateMessage()`.

**`FakeProxyProcess`** — extends `FakeProcess`, implements `IProxyProcess`. Adds `sentCommands[]` tracking and `sendCommand(command)` that serializes to JSON via the inherited `send` method. Helpers: `simulateInitialization()`, `simulateInitializationFailure(error)`.

**`FakeProxyProcessLauncher`** — implements `IProxyProcessLauncher`. Tracks `launchedProxies[]`. Auto-responds to `init` commands with `init_received` status. `prepareProxy(setupFn)` injects custom behavior for the next launch. `getLastLaunchedProxy()`, `reset()`.

Design rationale: fakes enable testing the proxy lifecycle (start, init handshake, DAP routing, exit) without spawning real Node subprocesses, keeping unit tests fast and deterministic.

### Auto-Mock Generation

**File:** `tests/unit/test-utils/auto-mock.ts`

- `createMockFromInterface<T>(target, options)` — generates a mock from a class or instance. All methods become `vi.fn()` stubs. Supports `excludeMethods`, `defaultReturns`, `includeInherited`.
- `validateMockInterface(mock, real, name)` — checks mock shape against real implementation, reports missing members (errors) and arity mismatches (warnings).
- `createValidatedMock<T>()` — combines creation + validation.
- `createEventEmitterMock<T>()` — generates all EventEmitter methods (`on`, `emit`, `once`, etc.) as `vi.fn()` stubs with `this` chaining.

## E2E Test Architecture

### How STDIO E2E Works

The standard pattern: `beforeAll` spawns the real MCP server as a child process via `StdioClientTransport` (`command: node dist/index.js`). The MCP SDK `Client` connects over stdio JSON-RPC. Tests call tools (`create_debug_session`, `set_breakpoint`, `start_debugging`, etc.) and parse responses through shared utilities.

**Shared utilities** (`tests/e2e/smoke-test-utils.ts`):

- **`parseSdkToolResult()`** — unwraps the MCP SDK's `ServerResult` envelope (`content[0].text`) and JSON-parses it into a plain object for assertions.
- **`callToolSafely()`** — wraps `mcpClient.callTool()` with error handling; returns `{ success: false, message }` instead of throwing on MCP errors.
- **`executeDebugSequence()`** — reusable flow: create session → set breakpoint → start debugging → return sessionId. Used by SSE smoke tests.
- **`waitForHealthEndpoint()`** — polls `http://localhost:{port}/health` for SSE server readiness.

Cleanup: `afterAll` closes the MCP client and kills the server process. `afterEach` closes the current session as a per-test safety net (errors caught and ignored if session already closed).

### STDIO Smoke Test Matrix

`tests/e2e/mcp-server-smoke-*.test.ts` is the per-language STDIO matrix. Rather than a count that goes stale, the shape of the set: every supported language has a launch smoke test (Python, JavaScript, Rust, Go, Java, .NET, Ruby, C++), and some languages carry extra files next to it — `-attach` for Python, JavaScript, Java, .NET, Ruby and C++; `-function-bp` for JavaScript, Rust and Java. Read that as the smoke coverage that exists, not as the capability matrix: every adapter policy except Ruby's sets `supportsFunctionBreakpoints: true` and Ruby's pins `false` (`packages/shared/src/interfaces/adapter-policy-*.ts`), and only three of them have a `-function-bp` file. Java carries the largest set of behavioral extras (`evaluate`, `inner-class`, `pause`, `event-race`, `redefine`). The same glob also picks up tests that are about the server rather than a language: `-restart`, `-http-stale-reap`, and the two SSE files below. `pnpm run test:e2e:smoke` runs the whole glob.

Each per-language test follows the standard lifecycle:

1. Create session → set breakpoint → start debugging
2. Inspect: stack trace, scopes, variables
3. Step through code (step over, step into, step out)
4. Continue execution → close session

Language-specific tests add specialized coverage: Java attach mode (spawn JVM with JDWP agent, use `attach_to_process`), Java expression evaluation, Java inner-class breakpoints, .NET with netcoredbg. Tests skip gracefully when toolchains are not installed.

### SSE Transport Tests

Two SSE test files test the SSE HTTP transport: Python over SSE (`mcp-server-smoke-sse.test.ts`) and JavaScript over SSE (`mcp-server-smoke-javascript-sse.test.ts`). Pattern: spawn server with `sse -p {port}` args, wait for health endpoint via polling, connect via `SSEClientTransport`, run the debug workflow.

### Comprehensive Matrix Test

**File:** `tests/e2e/comprehensive-mcp-tools.test.ts`

Tests all 28 MCP tools across 9 languages (Python, JavaScript, Mock, Rust, Ruby, Go, Java, Dotnet, C++) where the toolchain is available. Produces a PASS/FAIL/SKIP matrix report with per-tool per-language status and timing. Toolchain detection uses `hasCommand()` checks (e.g., `rustc --version`, `go version`).

The tool list is **derived**, not hand-maintained: the file imports `TOOL_NAMES` from `src/server/tool-schemas.ts` (`const ALL_TOOLS = [...TOOL_NAMES]`). The literal it replaced had drifted to 25 of the 28 advertised tools, so three were missing from the report with nothing to say so (issue #579). Tools the suite does not exercise now show as PENDING — the honest reading, and the reason to keep the list derived.

### Docker E2E

**Files:** `tests/e2e/docker/` (7 test files: Python, JavaScript, Rust, C++ and Ruby-attach / C++-attach smoke tests, plus entrypoint validation)

**Utilities** (`tests/e2e/docker/docker-test-utils.ts`):

- `buildDockerImage()` — deduplicates builds across test files via a shared promise. Uses `scripts/docker-build-if-needed.js` for incremental builds. `DOCKER_FORCE_REBUILD=true` bypasses cache.
- `createDockerMcpClient()` — runs `docker run -i --rm` with volume mounts, connects through Docker's stdio pipe via `StdioClientTransport`.
- `hostToContainerPath()` — converts host absolute paths to container-relative paths (workspace mounted at `/workspace`).
- `getDockerLogs()` — extracts container logs for debugging failures.

### NPX Distribution E2E

**Files:** `tests/e2e/npx/` (3 test files: Python, JavaScript and Rust smoke tests)

**Utilities** (`tests/e2e/npx/npx-test-utils.ts`):

- `buildAndPackNpmPackage()` — runs `npm pack` with SHA256 fingerprint caching to avoid redundant packs across test files. File-based lock prevents race conditions.
- `installPackageGlobally()` — `npm install -g <tarball>`.
- `createNpxMcpClient()` — resolves the globally-installed CLI entry (`@debugmcp/mcp-debugger/dist/cli.mjs`), spawns via `StdioClientTransport`. Avoids `npx.cmd` Windows issues by spawning Node directly.
- `verifyPackageContents()` — checks tarball for adapter presence and reports bundle size.
- `cleanupGlobalInstall()` — `npm uninstall -g` in `afterAll`.

Transport instrumentation hooks `transport.send` and `transport.onmessage` to log raw MCP messages to `npx-raw.log` for protocol debugging.

## Key Testing Patterns

### Event-Driven Testing

`waitForEvent(emitter, event, timeout)` (`tests/test-utils/helpers/test-utils.ts`) wraps `emitter.once()` in a promise with a configurable timeout (default 5 seconds). Used for testing async DAP events without polling.

Event simulation methods are available on all major mocks:
- `MockProxyManager`: `simulateStopped(threadId, reason)`, `simulateEvent(event, ...args)`, `simulateError(error)`, `simulateExit(code, signal)`
- `MockDapClient`: `simulateEvent(event, data)`, `simulateRequestError(cmd, error)`, `simulateConnectionError(error)`
- `FakeProcess`: `simulateMessage(message)`, `simulateExit(code, signal)`, `simulateProcessError(error)`
- `FakeProxyProcess`: `simulateInitialization()`, `simulateInitializationFailure(error)`

The `simulate*` methods that emit do so **synchronously** — `simulateStopped`, `simulateEvent`, `simulateError`, `simulateExit`, `simulateMessage`, `simulateProcessError`, `simulateInitialization` and `simulateInitializationFailure` all reach a bare `this.emit(...)`, with no `process.nextTick()` or `setTimeout()` deferral. Two of the listed methods emit nothing at all: `MockDapClient.simulateRequestError` records the error in a map that the `sendRequest` mock rejects from, and `simulateConnectionError` primes `connect.mockRejectedValueOnce`. (Elsewhere on `FakeProcess`, `send()` and `simulateSpawn()` *do* defer via `process.nextTick`, so the rule is per-method, not per-class.) The consequence of the synchronous ones is a sequencing rule, not a style note: the listener has to be attached before you call one, or the event lands on nobody. `FakeProxyProcessLauncher` keeps its own emission off the caller's stack — its automatic `init_received` answer wraps `simulateMessage` in `process.nextTick` rather than replying inside the `sendCommand` call. `prepareProxy(setup)` offers no such deferral: it calls `setup` immediately, at *prepare* time, before the proxy is launched and before `ProxyManager` subscribes, so a callback that wants its message seen has to defer the call itself.

### Fake Timer Usage

Pattern: `vi.useFakeTimers()` in a try/finally block with `vi.useRealTimers()` in finally. `vi.advanceTimersByTimeAsync(ms)` triggers specific timeouts; `vi.runAllTimersAsync()` flushes all pending timers. Used for testing proxy initialization timeouts, session cleanup timers, and debounced operations without waiting for real wall-clock time.

### Call Tracking

- `MockProxyManager.startCalls[]` and `dapRequestCalls[]`: arrays of recorded invocations for structural assertions
- `FakeProxyProcess.sentCommands[]`: tracks all commands sent to the proxy
- `vi.fn()` matchers: `expect(mock.method).toHaveBeenCalledWith(...)`, `.toHaveBeenCalledTimes(n)`

### Process Cleanup Discipline

- **`afterEach`** (global via setup file): `vi.resetAllMocks()` + `vi.restoreAllMocks()`
- **`afterEach`** (test-local): close sessions, stop proxy managers, reset fake launchers
- **`afterAll`**: close MCP client and transport, reset port manager
- E2E tests close sessions in both `afterEach` and `afterAll` as a safety net — the second close catches sessions left open by failed tests (errors are caught and ignored)

## Specialized Test Categories

### Stress Tests

**Location:** `tests/stress/`

Gated behind `RUN_STRESS_TESTS=true` (uses `describe.skip` otherwise). `sse-stress.test.ts` exercises rapid connect/disconnect cycles, concurrent sessions, long-running connections, and resource leak detection — collecting metrics (connections attempted/succeeded/failed, average connect time, memory usage). `cross-transport-parity.test.ts` runs identical debug sequences over STDIO and SSE, comparing results for equivalence.

### Manual Tests

**Location:** `tests/manual/`

Interactive scripts not run by Vitest. For ad-hoc debugging of SSE connections, debugpy transport, js-debug transport, and proxy behavior. Includes `.cjs`, `.mjs`, `.ts`, `.py`, `.js`, and `.cmd` files.

### Validation Tests

**Location:** `tests/validation/`

Protocol-level correctness checks. `breakpoint-messages/` contains Python scripts that verify debugpy breakpoint message formats at the DAP wire level.

## Coverage Strategy

**Provider:** Istanbul. **Reporters:** text, json, html, json-summary (output to `./coverage/`). `reportOnFailure: true` ensures partial coverage is captured even when tests fail. Coverage is configured at the **root** of `vitest.config.ts`, not per project — a per-project `coverage` block is silently ignored.

**Thresholds are enforced**, and a run below them fails:

| Metric | Threshold | Measured at the time it was set |
|---|---|---|
| Statements | 90 | 92.9 |
| Branches | 80 | 83.0 |

The margins absorb platform-specific branches (win32-only arms uncovered on Linux and vice versa). The config's own instruction is to raise them when the measured numbers move up, and never to loosen them to admit a regression.

**Excluded from coverage** (with rationale):
- Test files and type-only files (`src/container/types.ts`, `src/dap-core/types.ts`) — no executable logic
- CLI entry points (`packages/mcp-debugger/src/cli-entry.ts`) — process-level stdio handling, not unit-testable
- Proxy entry point (`src/proxy/dap-proxy-entry.ts`) and bootstrap (`src/proxy/proxy-bootstrap.js`) — run as a separate process
- Mock adapter process (`mock-adapter-process.ts`) — tested via E2E, not importable
- Module-init side-effects (`packages/mcp-debugger/src/batteries-included.ts`) — static adapter imports plus a module-level side effect that registers each adapter factory into a `globalThis[GLOBAL_KEY]` registry with language-based deduplication
- Error definitions (`src/errors/debug-errors.ts`) — mostly class constructors and type guards
- Script entry point (`packages/adapter-dotnet/src/utils/netcoredbg-bridge.ts`) — `process.argv` parsing only; the logic it wraps lives in `netcoredbg-bridge-core.ts` and is covered there
- Barrel/index exports (`packages/shared/src/index.ts`, `packages/shared/src/models/index.ts`) — prevent duplicate coverage counting
- Factory pattern files with minimal logic (`packages/shared/src/factories/adapter-factory.ts`)

**Included:** `src/**/*.{ts,js}`, `packages/**/src/**/*.{ts,js}`.

**Commands:** `npm run test:coverage` (full HTML), `npm run test:coverage:summary` (table), `npm run test:coverage:analyze` (detailed).

## Type Checking the Test Suite

Coverage says how much of the suite *ran*. A second, independent mechanism gates how well the suite is *typed* — because a test double that has silently drifted from the interface it stands for still runs green, and that is precisely the failure mode compile-checked fakes exist to catch.

### Two TypeScript programs

**`tsconfig.typecheck.json`** is a type-only program (`noEmit`, `composite: false`) covering every first-party source file — `src/**` and `packages/*/src/**` — in one pass. It exists because the root `tsconfig.json` is solution-style with `"files": []` and therefore checks nothing (issue #562). One wildcard `paths` entry, `"@debugmcp/*": ["./packages/*/src/index.ts"]`, resolves workspace packages to their TS sources, so the check runs on a fresh clone with no `dist/`; a per-adapter row would be one more thing to forget when adding an adapter, and a missing row fails quietly. `lib` is pinned to `["ES2022"]` because the default for target ES2022 drags in DOM, and `lib.dom`'s `Body.json()` returning `any` had already masked two real errors. This program must be **clean**: `pnpm run typecheck`.

**`tsconfig.spec.json`** extends it and adds the test trees (`tests/**`, `packages/*/tests/**`), with `moduleResolution: "Bundler"` because tests are resolved by Vitest, not Node, and import extensionless specifiers. `tests/fixtures` and `tests/manual` are excluded — Vitest never runs them, and type-checking them only produced baseline entries nobody would act on.

### The ratchet

`tsconfig.spec.json` does **not** pass today, so `scripts/typecheck-tests-ratchet.mjs` (`pnpm run typecheck:tests`) gates on the **per-file** error count recorded in `tests/typecheck-baseline.json` instead of demanding zero.

Per file rather than one total: the errors span nearly every test directory, so a single number would let a new error hide behind an unrelated fix, and errors moving between files would go unnoticed. The known limitation is that the unit is a per-file *count*, so a same-file, same-count swap is invisible; the burn-down surfaces it eventually, and per-diagnostic fingerprints are the upgrade path if it stalls.

The gate fails in **both** directions — an increase means new type errors, and a decrease (including a removed test file) means the recorded numbers are now a lie. Only `pnpm run typecheck:tests:update` clears the second case, and the refreshed baseline must be committed in the same change. That is what keeps the ceiling monotonically falling.

Three defenses around the gate itself:

- **It fails closed when it cannot trust the run.** A diagnostic in the TS1000–1999 grammar band, or one anchored outside the test trees (`tsconfig.spec.json` itself, `src/**`, a `../` path), means the check is broken rather than failing — baselining it with `--update` would hide the breakage. An all-clear run is likewise treated as suspicious rather than celebrated: far more likely a program that no longer includes the test trees. Exit code 2 means "could not be run", distinct from 1, "ratchet failure".
- **A corrupt baseline blocks its own repair**, deliberately: `--update` reads the baseline before writing one, so the gate's floor applies to the refresh too. The script's remedy is to delete the file first.
- **`--allow-improvement` is the one loosening**, and it only downgrades the *decrease* case to a warning; increases still fail. CI passes it exclusively for PRs **authored by** `dependabot[bot]` (keyed on the PR author, not `github.actor`, so a human touching the bot's PR takes the strict path — issue #581). A Dependabot bump can make the suite type-cleaner via a better `@types` package, and the bot cannot re-record. The cost is accepted loudly: that PR may auto-merge with `GITHUB_TOKEN`, which suppresses push CI on main, so the ratchet emits a `::warning` annotation and a job-summary line saying the next human PR must refresh the baseline.

### Where it runs

`pnpm run typecheck:all` = `typecheck` + `typecheck:tests`, and it is deliberately the *same command* in all three places, so a green working tree cannot mean a red required check:

1. **`.husky/pre-push`** — lint, then a guard that `tests/typecheck-baseline.json` is not modified-but-uncommitted (the ratchet validates the working tree; CI validates the pushed commit, so an uncommitted refresh would pass here and fail there), then `typecheck:all`, then a clean build, then `test:unit` + `test:integration`. The full e2e suite is left to CI.
2. **The `Lint Code` CI job** — ESLint, then `typecheck:all` (or the split dependabot form), then the personal-path and changelog gates. No build needed: ~3 s for the sources, ~11 s for the ratchet.
3. **Locally**, whenever you want the fast type-only answer without a build.

`.husky/pre-commit` deliberately runs none of this — only the personal-paths check, the build-artifact/tarball guards, and an optional docstar check. Commits stay cheap; the gate is at push.
