# MCP Debug Server - Testing Guide

This guide covers how to write and run tests for the MCP Debug Server project.

Two companion documents cover what this one deliberately does not:

- [`tests/README.md`](../../tests/README.md) — the directory layout, the full command list, and where a new test file belongs.
- [`docs/architecture/testing-architecture.md`](../architecture/testing-architecture.md) — the *why* behind the mock architecture, the project split, and the coverage/type gates.

## Test Framework

The project uses **Vitest**, for its native ESM support, Jest-compatible API, built-in TypeScript handling, and watch mode.

Vitest is configured with **three projects** in `vitest.config.ts`, and you select one with `--project` — not `--exclude`, which Vitest silently ignores once `projects` is set:

| Project | Contents | Parallelism | Timeout |
|---|---|---|---|
| `unit` | hermetic, millisecond-scale tests | files run **in parallel** (`forks`, no worker cap) | 15 s |
| `integration` | `tests/**/integration/**` and `tests/stress/**` | serial (`maxWorkers: 1`) | 30 s |
| `e2e` | `tests/e2e/**` — smoke, Docker, npx | serial (`maxWorkers: 1`) | 30 s |

The practical consequence when writing a test: **a unit test must be hermetic.** It shares no port, no temp directory, and no `process.env` with the file running beside it, because there probably is a file running beside it. Anything that spawns a real process or binds a real port belongs in `integration` or `e2e`, where the serial pool protects it.

## Running Tests

### Basic Commands

```bash
# Everything (builds first, then runs all three projects)
npm test

# One project
npm run test:unit
npm run test:integration
npm run test:e2e

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# A single file
npx vitest run tests/core/unit/session/session-manager-workflow.test.ts

# Tests whose NAME matches a pattern (there is no --grep flag in Vitest)
npx vitest run -t "should complete full debug workflow"
```

`-t` is short for `--testNamePattern`; it filters on the `describe`/`it` text, not the file path. To filter by path, pass the path — a bare positional argument is a substring filter on the filename, not a glob.

### Coverage Reports

```bash
npm run test:coverage          # full run; HTML report at coverage/index.html
npm run test:coverage:summary  # summary table
npm run test:coverage:analyze  # detailed analysis
```

Coverage uses the `istanbul` provider and emits `text`, `json`, `html`, and `json-summary` reports. **Thresholds are enforced** in `vitest.config.ts` — 90% statements and 80% branches — so a run below either number fails rather than merely reporting. The margins exist to absorb platform-specific branches (win32-only arms are uncovered on Linux and vice versa); raise them when the measured numbers rise, never lower them to admit a regression.

Coverage is configured at the **root** of the config, not inside a project. A per-project `coverage` block is silently ignored.

### Type Checking

Type checking is a separate gate from the test run, and it is the one most likely to block your push unexpectedly.

```bash
pnpm run typecheck               # src + packages/*/src — must be clean
pnpm run typecheck:tests         # the test trees, ratcheted
pnpm run typecheck:tests:raw     # raw tsc output for tsconfig.spec.json
pnpm run typecheck:tests:update  # re-record the baseline
pnpm run typecheck:all           # both — exactly what CI and pre-push run
```

`tsconfig.spec.json` type-checks the test trees alongside the sources. It does **not** pass today — the suite carries a backlog of mock/type divergences — so `scripts/typecheck-tests-ratchet.mjs` gates on the **per-file** error count recorded in `tests/typecheck-baseline.json` instead of demanding zero.

The ratchet fails in **both** directions:

- **A count went up.** You introduced type errors in that file. Fix them. Re-recording the baseline is the exception, not the remedy.
- **A count went down, or a test file was removed.** That is progress, but the baseline is now stale: run `pnpm run typecheck:tests:update` and commit `tests/typecheck-baseline.json` in the same change.

Two things that will bite you otherwise:

- **Pre-push refuses to run** while `tests/typecheck-baseline.json` is modified but uncommitted. The ratchet validates your working tree; CI validates the pushed commit. An uncommitted refresh would pass locally and fail in CI, so `.husky/pre-push` blocks that state outright.
- If the ratchet cannot read the baseline at all (invalid JSON, wrong shape, a path outside the test trees) it exits **2** — "could not be run", as distinct from 1, "ratchet failure" — and tells you to **delete the file first**. `--update` reads the baseline before writing one, so a corrupt file blocks its own repair.

### What the Gates Actually Run

Worth knowing before you wonder why a push takes four minutes:

- **`.husky/pre-commit`** runs no tests and no build — only the personal-paths check, the build-artifact/tarball guards, and an optional docstar check. Commits stay cheap.
- **`.husky/pre-push`** runs lint → the uncommitted-baseline guard → `typecheck:all` → a clean build → `test:unit` + `test:integration`. The e2e suite is left to CI.
- **The `Lint Code` CI job** runs ESLint → `typecheck:all` → the personal-path and changelog gates. No build needed.

## Writing Tests

### Test File Organization

Tests follow the source structure loosely, across several test roots rather than one mirrored tree:

```
src/session/session-manager*.ts
→ tests/core/unit/session/session-manager-workflow.test.ts
→ tests/core/unit/session/session-manager-state.test.ts
→ tests/core/unit/session/session-manager-dap.test.ts        (…and ~30 more slices)

src/session/launch/proxy-launcher.ts
→ tests/core/unit/session/launch/proxy-launcher.test.ts

src/proxy/proxy-manager.ts
→ tests/unit/proxy/proxy-manager.start.test.ts
→ tests/unit/proxy/proxy-manager.handshake.test.ts
→ tests/unit/proxy/proxy-manager-message-handling.test.ts
→ tests/unit/proxy/proxy-manager.branch-coverage.test.ts
```

Note the roots: `tests/core/unit/` holds the session/server/factory core, `tests/unit/` holds everything else (adapters, CLI, DI container, DAP core, proxy, utils, and repo tooling), `tests/adapters/{lang}/` holds per-language tests, and most adapter packages additionally carry `packages/adapter-{lang}/tests/` — `adapter-java` is the exception, its tests live only under `tests/adapters/java/unit/`. There is no `tests/unit/session/`. See [`tests/README.md`](../../tests/README.md) for the full map.

**File naming**: `*.test.ts` or `*.spec.ts`. Both are picked up.

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComponentToTest } from '../../../src/component-to-test.js';

describe('ComponentToTest', () => {
  let component: ComponentToTest;
  let mockDependency: MockType;

  beforeEach(() => {
    mockDependency = createMockDependency();
    component = new ComponentToTest(mockDependency);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers(); // if the test used fake timers
  });

  describe('methodName', () => {
    it('should handle normal case', async () => {
      // Arrange
      const input = 'test-input';

      // Act
      const result = await component.methodName(input);

      // Assert
      expect(result).toBe('expected-output');
      expect(mockDependency.someMethod).toHaveBeenCalledWith(input);
    });

    it('should handle error case', async () => {
      mockDependency.someMethod.mockRejectedValue(new Error('Test error'));

      await expect(component.methodName('input')).rejects.toThrow('Test error');
    });
  });
});
```

`tests/vitest.setup.ts` already calls `vi.resetAllMocks()`, `vi.restoreAllMocks()`, and `vi.unstubAllEnvs()` after every test, so a local `afterEach` is for *your* resources — sessions, proxy managers, fake launchers — not for the global mock slate.

### Testing Patterns

#### 1. Mocking Dependencies

```typescript
import {
  createMockDependencies,
  createMockLogger,
  createMockFileSystem
} from '../../test-utils/helpers/test-dependencies.js';

const deps = createMockDependencies();   // the whole DI container, every method a vi.fn()
const mockLogger = createMockLogger();   // or a single seam

expect(mockLogger.info).toHaveBeenCalledWith(
  '[Component] Operation completed',
  { sessionId: 'test-123' }
);
```

**Watch which `createMockFileSystem` you import.** Two exist and they behave differently:

| Import from | Behavior |
|---|---|
| `test-utils/helpers/test-dependencies.js` | every member is a bare `vi.fn()` — configure return values per test |
| `test-utils/helpers/test-utils.js` | pre-configured defaults (`pathExists`/`exists` resolve `true`, `readFile` resolves `''`, `stat` resolves a mock stat object) and also stubs `createWriteStream`/`createReadStream` |

Pick the one that matches what your test asserts. A test that fails with `undefined is not a function` on a stream, or that mysteriously finds every path existing, has usually imported the other one.

#### 2. Fakes vs Mocks

Before hand-rolling `as unknown as SomeInterface`, check whether a compile-checked fake already exists — that cast silences exactly the divergence the double is there to catch.

- **`tests/test-utils/fakes/fake-debug-adapter.ts`** — `FakeDebugAdapter`, a class that `implements IDebugAdapter`, so the compiler rejects it the moment the interface moves. Required members are `vi.fn`s with production-shaped defaults; the optional ones are **absent** unless you opt in with `withAttachSupport()` / `withLaunchBarrier()`, because production guards them (`adapter.supportsAttach?.()`) and a double that always defined them would only ever exercise one branch.
- **`tests/test-utils/mocks/mock-proxy-manager.ts`** — `MockProxyManager` does the same job for `IProxyManager` (it predates the `fakes/` directory).
- **`tests/test-utils/mocks/*`** — `vi.fn` bags for narrow seams, where an untyped literal costs little and reads more directly.

See [`tests/README.md`](../../tests/README.md) — *Fakes vs mocks* — for the rule of thumb.

#### 3. Testing with Fake Timers

Every proxy retry/timeout path in the unit suite runs on fake timers. That is not a style preference — it is what let the `unit` project go parallel with a 15 s ceiling, so a test that burns real backoff is a regression.

```typescript
it('should timeout after the configured duration', async () => {
  vi.useFakeTimers();

  try {
    const operationPromise = component.operationWithTimeout();

    // Create the expectation BEFORE advancing time, or the rejection
    // fires with nothing attached to it.
    const expectPromise = expect(operationPromise).rejects.toThrow('Operation timed out');

    await vi.advanceTimersByTimeAsync(5001);
    await expectPromise;
  } finally {
    vi.useRealTimers();
  }
});
```

`vi.runAllTimersAsync()` flushes everything pending, which is the usual choice when you just need the async machinery to settle.

#### 4. Waiting Without Sleeping

For real-time async state, use `waitUntil` rather than a fixed `delay()` — it returns as soon as the condition holds, and fails with a useful message if it never does, instead of surfacing as a flaky assertion downstream:

```typescript
import { waitUntil } from '../../test-utils/helpers/test-utils.js';

await waitUntil(() => session.state === SessionState.PAUSED, {
  timeout: 5000,
  interval: 50,
  message: 'session to pause'
});
```

#### 5. Testing Event Emissions

```typescript
it('should emit events correctly', async () => {
  const eventPromise = new Promise<{ data: string }>((resolve) => {
    component.once('data-ready', (data) => resolve({ data }));
  });

  component.processData();

  const result = await eventPromise;
  expect(result.data).toBe('processed');
});
```

`waitForEvent(emitter, event, timeout)` in `tests/test-utils/helpers/test-utils.ts` wraps that pattern.

**Never attach a listener to `process` and leave it there.** The setup file compares `process.rawListeners` against a baseline after every test, removes anything leaked, and logs a `[process-listener-leak]` error — leaked process listeners can hard-kill the Vitest fork worker (issue #159). Capture handlers with `mockImplementation` instead of attaching them, or remove them in `afterEach`. Run `npm run test:strict` (`LEAK_GUARD_STRICT=1`) to turn that warning into a failure.

#### 6. Testing with the Fake Process Launcher

```typescript
// tests/implementations/test/fake-process-launcher.ts
import { FakeProxyProcessLauncher } from '../../implementations/test/fake-process-launcher.js';

it('should handle process messages', async () => {
  const fakeLauncher = new FakeProxyProcessLauncher();

  fakeLauncher.prepareProxy((proxy) => {
    // The setup callback runs at PREPARE time — before the proxy is launched
    // and before ProxyManager subscribes. `simulateMessage` emits synchronously,
    // so calling it inline here would emit to nobody. Defer it.
    setTimeout(() => {
      proxy.simulateMessage({ type: 'status', status: 'initialized' });
    }, 100);
  });

  // ProxyManager(adapter, proxyProcessLauncher, fileSystem, logger)
  const manager = new ProxyManager(null, fakeLauncher, mockFileSystem, mockLogger);
  await manager.start(config);

  expect(fakeLauncher.launchedProxies).toHaveLength(1);
});
```

This exercises the real proxy lifecycle — start, init handshake, DAP routing, exit — without spawning a Node subprocess, which is what keeps it in the parallel `unit` project.

The same sequencing rule applies to every `simulate*` helper on the mocks and fakes: they are a bare `this.emit(...)`, so the listener must already be attached. `MockProxyManager.simulateStopped(...)` works inline in the worked example below precisely because `startDebugging` has already returned by then.

#### 7. Reaching the Operations Collaborators

`SessionManagerOperations` is a facade of thin delegates over collaborators (`launcher`, `proxyLauncher`, `execution`, …) held as **protected** fields. Driving or spying on one needs a cast, and that cast lives in exactly one place:

```typescript
import { internals } from '../../test-utils/helpers/operations-internals.js';

const startSpy = vi.spyOn(internals(sessionManager).proxyLauncher, 'start');
```

Add to `OperationsInternals` rather than re-casting in your file — two suites had already grown byte-identical copies of the cast, and the copies had started to disagree about which collaborators they named.

### Testing Error Scenarios

```typescript
describe('error handling', () => {
  it('should handle file not found', async () => {
    vi.mocked(mockFileSystem.pathExists).mockResolvedValue(false);

    await expect(component.loadFile('missing.txt'))
      .rejects.toThrow('File not found: missing.txt');
  });

  it('should clean up on error', async () => {
    vi.mocked(mockService.connect).mockRejectedValue(new Error('Connection failed'));

    await expect(component.initialize()).rejects.toThrow();

    expect(component.isInitialized()).toBe(false);
    expect(mockService.disconnect).toHaveBeenCalled();
  });

  it('should use centralized error messages', async () => {
    // src/utils/error-messages.ts — assert against the constructor, not a
    // copied string, so a reworded message updates both sides at once.
    await expect(component.operationWithTimeout())
      .rejects.toThrow(ErrorMessages.proxyInitTimeout(30));
  });
});
```

### A Worked Session Workflow

The API shapes below are the real ones. `startDebugging` is **positional**; `setBreakpoint` takes a **breakpoint object**.

```typescript
// tests/core/unit/session/session-manager-workflow.test.ts
// Session workflow tests use createMockDependencies from the LOCAL helper because
// it returns a different shape: SessionManagerDependencies plus the individual
// mocks (mockProxyManager, mockFileSystem, ...), and it supplies environment,
// pathUtils and adapterRegistry. The test-utils/helpers version returns the DI
// Dependencies (fileSystem, processManager, networkManager, logger,
// proxyProcessLauncher, proxyManagerFactory, sessionStoreFactory) and none of
// those three. Neither helper calls vi.mock; both build vi.fn()-based objects.
import { createMockDependencies } from './session-manager-test-utils.js';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage, SessionState } from '@debugmcp/shared';

describe('SessionManager - Debug Session Workflow', () => {
  let sessionManager: SessionManager;
  let dependencies: ReturnType<typeof createMockDependencies>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    dependencies = createMockDependencies();

    const config: SessionManagerConfig = {
      logDirBase: '/tmp/test-sessions',
      defaultDapLaunchArgs: { stopOnEntry: true, justMyCode: true }
    };

    sessionManager = new SessionManager(config, dependencies);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    dependencies.mockProxyManager.reset();
  });

  it('should complete create → start → breakpoint → step', async () => {
    const session = await sessionManager.createSession({
      language: DebugLanguage.MOCK,
      name: 'Workflow Test'
    });

    // startDebugging(sessionId, scriptPath, scriptArgs?, dapLaunchArgs?,
    //                dryRunSpawn?, adapterLaunchConfig?, breakOnExceptions?)
    const startPromise = sessionManager.startDebugging(
      session.id,
      'test.py',
      [],
      { stopOnEntry: true }
    );

    // Let the mock proxy emit its events.
    await vi.runAllTimersAsync();

    const startResult = await startPromise;
    expect(startResult.success).toBe(true);
    expect(startResult.state).toBe(SessionState.PAUSED);

    // setBreakpoint(sessionId, { file, line, condition?, suspendPolicy?,
    //                            logMessage?, requestedLine?, anchor? })
    const { breakpoint } = await sessionManager.setBreakpoint(session.id, {
      file: 'test.py',
      line: 15
    });
    expect(breakpoint.verified).toBe(true);

    // Step methods take only (sessionId).
    dependencies.mockProxyManager.simulateStopped(1, 'entry');
    const stepResult = await sessionManager.stepOver(session.id);
    expect(stepResult.success).toBe(true);
  });
});
```

A dry run is the fifth positional argument, and is the cheapest way to assert on spawn configuration without a debuggee:

```typescript
const result = await sessionManager.startDebugging(session.id, 'test.py', [], {}, true);
expect((result.data as { dryRun?: boolean })?.dryRun).toBe(true);
```

## Test Utilities

### Mock Creation Helpers

`tests/test-utils/helpers/test-dependencies.ts` exports `createMockDependencies()` — a complete DI container matching the `Dependencies` interface (`fileSystem`, `processManager`, `networkManager`, `logger`, `proxyProcessLauncher`, `proxyManagerFactory`, `sessionStoreFactory`) — plus the narrower `createMockLogger()`, `createMockFileSystem()`, `createMockProcessManager()`, `createMockNetworkManager()`, `createMockProxyProcessLauncher()`, and `createMockEnvironment()`.

`tests/test-utils/helpers/test-utils.ts` exports `delay()`, `waitUntil()`, `waitForEvent()`, and its own (pre-configured) `createMockLogger()` / `createMockFileSystem()`.

`tests/unit/test-utils/auto-mock.ts` generates a mock from a class or instance (`createMockFromInterface`), validates a mock's shape against the real implementation (`validateMockInterface`), and combines the two (`createValidatedMock`).

### Test Fixtures

Python script *content* lives as TypeScript string constants in `tests/test-utils/fixtures/python-scripts.ts` (`simpleLoopScript`, `functionCallScript`, `fibonacciScript`, `exceptionHandlingScript`, `multiModuleMainScript`, `multiModuleHelperScript`, `buggyScript`). Actual fixture *files* live in `tests/fixtures/`, in four directories:

```
tests/fixtures/
├── adversarial-adapter/  # server.mjs — a scripted TCP DAP adapter that misbehaves on demand
├── debug-scripts/        # small debuggees (simple.py, with-variables.py, with-errors.py,
│                         #   simple-mock.js, js-throws.js, ruby-clean-exit.rb, …)
├── javascript-e2e/       # TypeScript fixture + its tsconfig
└── python/               # Python debuggees for attach/E2E (debugpy_server.py,
                          #   debug_test_simple.py, attach_then_raise.py)
```

The **adversarial adapter** is worth knowing about: it is a deterministic DAP scenario player driven by a JSON scenario (`dropResponse`, `eventsBeforeResponse`, `delayMs`, `close: "mid-response"`). Tests inject it through the internal `ProxyConfig.adapterCommand` seam, so it drives the production proxy worker, socket framing, policy handshake, and parent/worker status IPC — without adding a test-only field to the MCP tool schema. Reach for it when you need to prove the proxy survives an adapter behaving badly. `tests/fixtures/` is excluded from `tsconfig.spec.json`, so fixtures are not type-checked by the ratchet.

### Port Management

```typescript
import { portManager, PortRange } from '../../test-utils/helpers/port-manager.js';

const port = portManager.getPort(PortRange.UNIT_TESTS); // 5679–5778
portManager.releasePort(port);                          // optional
```

Three non-overlapping 100-port ranges anchored at 5679: `UNIT_TESTS` (5679–5778), `INTEGRATION` (5779–5878), `E2E` (5879–5978). The manager tracks allocations in an in-process `Set`, so it prevents collisions *within* a worker; it does not guarantee the OS has the port free.

## Debugging Tests

### Running One Thing

```bash
npx vitest run tests/unit/proxy/proxy-manager.start.test.ts   # one file
npx vitest run -t "launches the proxy process"                # one test, by name
npm run test:watch                                            # watch mode
npm run test:verbose                                          # verbose reporter
npm run test:failures                                         # summarize failures from the last run
npm run test:summary                                          # summarize the last run
```

### Console Output Is Filtered

`vitest.config.ts` installs an `onConsoleLog` filter, so a bare `console.log('Input:', data)` from a test may never reach your terminal. The filter suppresses a list of noise patterns (server log prefixes, timestamps, `spawn`, `node_modules`, …) and, by default, suppresses stdout while keeping stderr.

The reliable ways to see your own output:

- `console.error(...)` — stderr passes by default.
- Prefix the message with one of the whitelisted markers: `[Discovery Test]`, `[Workflow Test]`, `[Test Server]`, `[env-utils]`, `[process-listener-leak]`. Lines containing `FAIL`, `Error:`, `Expected`, `Received`, `AssertionError`, `TypeError`, or `ReferenceError` also always pass.

Chasing a "my log statement disappeared" ghost here is a common first-hour tax; it is the filter, not your test.

### Reproducing an Order-Dependent Failure

Every run shuffles **file** order under a seed, so a failure you cannot reproduce may be an order dependency rather than a flake. The seed is printed by the run. Reproduce it with:

```bash
vitest run --project unit --sequence.seed=<seed>
```

To hunt for the class of bug deliberately — a test leaning on a sibling's leftover mock or env state — `npm run test:flake` loops the `unit` project under fresh explicit seeds *with* within-file shuffle (`--sequence.shuffle.tests`), prints each seed, and exits non-zero listing the ones that failed. Within-file shuffle is not in the committed config on purpose: the integration and e2e suites share one live debug session across `it` blocks and would break if reordered.

### VS Code

Set a breakpoint in the test file and launch it with the debugger; step through as usual.

## Best Practices

### 1. Test Naming

Names should say what and why:

```typescript
// ❌
it('should work', () => {});
it('test error', () => {});

// ✅
it('should return empty array when no sessions exist', () => {});
it('should throw timeout error when adapter does not respond within 30s', () => {});
```

### 2. Group Related Tests

```typescript
describe('SessionManager', () => {
  describe('session lifecycle', () => {
    describe('createSession', () => {
      it('should generate unique session ID', () => {});
      it('should set initial state to CREATED', () => {});
    });

    describe('closeSession', () => {
      it('should clean up resources', () => {});
      it('should handle an already-closed session', () => {});
    });
  });
});
```

### 3. Keep Tests Independent

With `fileParallelism: true` on the `unit` project and file-order shuffling on every run, an order-dependent test is not a latent risk — it is a test that will fail on somebody's machine this week.

```typescript
// ❌ depends on execution order
let sharedSession: Session;
it('should create session', () => { sharedSession = createSession(); });
it('should use session', () => { expect(sharedSession.id).toBeDefined(); });

// ✅ each test stands alone
it('should create session', () => {
  expect(createSession().id).toBeDefined();
});
it('should process session', () => {
  expect(processSession(createSession())).toBeDefined();
});
```

The one sanctioned exception is the integration/e2e suites, which drive a single live debug session through create → … → close across `it` blocks. That is why within-file shuffle stays out of the committed config.

### 4. Use Factories for Complex Objects

```typescript
function createTestSession(overrides?: Partial<Session>): Session {
  return {
    id: 'test-session-123',
    state: SessionState.CREATED,
    language: DebugLanguage.PYTHON,
    breakpoints: new Map(),
    ...overrides
  };
}

it('should handle paused session', () => {
  const session = createTestSession({ state: SessionState.PAUSED });
  // …
});
```

### 5. Test Both Paths

```typescript
describe('file operations', () => {
  it('should read file successfully', async () => {
    mockFs.readFile.mockResolvedValue('content');
    expect(await component.readConfig()).toBe('content');
  });

  it('should handle file read error', async () => {
    mockFs.readFile.mockRejectedValue(new Error('ENOENT'));
    await expect(component.readConfig()).rejects.toThrow('Configuration file not found');
  });
});
```

## Common Issues and Solutions

### Pre-push blocks on `tests/typecheck-baseline.json`

**Symptom**: `tests/typecheck-baseline.json is modified but not committed`, and the push stops before any test runs.

**Fix**: commit the baseline in the same change. CI reads the pushed commit, not your working tree, so an uncommitted refresh is a guaranteed CI failure the hook is saving you from.

### The ratchet exits 2

**Symptom**: not "you added type errors" but "the check could not be run" — a corrupt or wrong-shaped baseline, or a diagnostic anchored outside the test trees.

**Fix**: delete `tests/typecheck-baseline.json`, then `pnpm run typecheck:tests:update`. Deleting first is required, not superstition: `--update` reads the baseline before writing one, so a corrupt file blocks its own repair.

### Flaky Timing Tests

**Fix**: fake timers, not longer timeouts. A unit test that needs more than the 15 s ceiling is a unit test doing something real, which means it belongs in `integration`.

```typescript
vi.useFakeTimers();
await vi.advanceTimersByTimeAsync(1000);
```

### `[process-listener-leak]` in the output

**Symptom**: the setup file reports (and removes) `process` listeners your test left behind.

**Fix**: capture handlers with `mockImplementation` instead of attaching them, or remove them in `afterEach`. Left in place they can hard-kill the Vitest fork worker (issue #159) — which surfaces as an unrelated file "failing" with no assertion. `npm run test:strict` promotes the warning to a failure.

### Resources Accumulating Across Tests

**Fix**: clean up what *you* created. The global `afterEach` already resets mocks and env stubs.

```typescript
afterEach(async () => {
  await sessionManager.closeAllSessions();
  fakeLauncher.reset();
  vi.useRealTimers();
});
```

### Cannot Mock ES Modules

**Fix**: `vi.mock` with a factory.

```typescript
vi.mock('../../../src/utils/logger.js', () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), error: vi.fn() }))
}));
```

## Summary

1. Descriptive test names.
2. Independent tests — the unit project runs in parallel and shuffles file order.
3. Mock external dependencies; prefer a compile-checked fake over `as unknown as`.
4. Cover both success and error paths.
5. Fake timers for anything that would otherwise wait.
6. Clean up what you created; the setup file handles the rest.
7. Keep coverage above the enforced 90/80 floor, and keep the type-error baseline shrinking.
