# Testing Architecture

This document explains the **design decisions and mechanisms** behind the mcp-debugger test suite. For directory layout, test commands, and file placement guidance, see [`tests/README.md`](../../tests/README.md).

The project targets 90%+ coverage across a multi-process, multi-language debug server that spawns real OS processes, connects to real debug adapters via DAP, and communicates over JSON-RPC. The test suite is organized into seven categories: unit, integration, E2E, proxy, stress, manual, and validation.

## Testing Philosophy

### Three-Level Testing Model

**Unit tests** verify components in isolation with mocked dependencies. This is the largest category. Every adapter, session manager method, proxy component, DI container, DAP handler, and utility function has unit coverage. Mocks substitute all external interfaces so each test exercises exactly one unit of logic.

**Integration tests** verify component interactions with real (or near-real) implementations. Per-language adapter integration tests exercise the full create-breakpoint-start-inspect-step-close path through the adapter layer, confirming that the adapter, proxy, and session manager cooperate correctly for a specific language runtime.

**E2E tests** verify complete user-visible workflows against real debug runtimes. They spawn the MCP server as a subprocess, connect a real MCP SDK client over JSON-RPC, call tools, and verify the debug adapter produces correct results. Nothing is mocked except the user.

### Isolation Strategy

The server spawns OS processes (proxy workers, debug adapters) that bind ports and consume system resources. Parallel test files would compete for ports, leave orphan processes, and produce flaky failures. The test suite therefore runs with:

- **`maxWorkers: 1`** — a single Vitest worker process
- **`fileParallelism: false`** — test files execute serially within that worker
- **`testTimeout: 30000`** (30 seconds) — safety net for hung processes

This is a deliberate trade-off: serial execution is slower but eliminates an entire class of non-deterministic failures that would be nearly impossible to debug in CI.

## Test Infrastructure

### Vitest Configuration

**File:** `vitest.config.ts`

Key settings beyond the isolation strategy above:

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
6. **`afterEach`**: calls `vi.resetAllMocks()` and `vi.restoreAllMocks()` to guarantee a clean slate per test.
7. **`afterAll`**: resets port manager.

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

The project maintains two parallel mock systems:

- **Mocks** (`tests/test-utils/mocks/`) — `vi.fn()`-based objects for call tracking and assertion. Answer: "was this method called with these arguments?"
- **Fakes** (`tests/implementations/test/`) — lightweight functional implementations with deterministic behavior. Answer: "given this input, does the system produce the right output?"

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

**Other mocks**: `MockLogger` (simple `vi.fn()` stubs for `info`/`error`/`debug`/`warn`), `MockCommandFinder` (per-command path mappings with call history), `createEnvironmentMock()` (defaults `MCP_CONTAINER` to `'false'` for host mode), minimal `fs-extra` and `net` mocks.

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

Nine per-language STDIO smoke tests: Python, JavaScript, Rust, Go, Java (launch), Java (attach), Java (evaluate), Java (inner class), .NET. Each follows the standard lifecycle:

1. Create session → set breakpoint → start debugging
2. Inspect: stack trace, scopes, variables
3. Step through code (step over, step into, step out)
4. Continue execution → close session

Language-specific tests add specialized coverage: Java attach mode (spawn JVM with JDWP agent, use `attach_to_process`), Java expression evaluation, Java inner-class breakpoints, .NET with netcoredbg. Tests skip gracefully when toolchains are not installed.

### SSE Transport Tests

Two SSE test files test the SSE HTTP transport: Python over SSE (`mcp-server-smoke-sse.test.ts`) and JavaScript over SSE (`mcp-server-smoke-javascript-sse.test.ts`). Pattern: spawn server with `sse -p {port}` args, wait for health endpoint via polling, connect via `SSEClientTransport`, run the debug workflow.

### Comprehensive Matrix Test

**File:** `tests/e2e/comprehensive-mcp-tools.test.ts`

Tests all 20 MCP tools across 5 languages (Python, JavaScript, Mock, Rust, Go) where the toolchain is available. Produces a PASS/FAIL/SKIP matrix report with per-tool per-language status and timing. Toolchain detection uses `hasCommand()` checks (e.g., `rustc --version`, `go version`).

### Docker E2E

**Files:** `tests/e2e/docker/` (4 test files: Python, JavaScript, Rust smoke tests + entrypoint validation)

**Utilities** (`tests/e2e/docker/docker-test-utils.ts`):

- `buildDockerImage()` — deduplicates builds across test files via a shared promise. Uses `scripts/docker-build-if-needed.js` for incremental builds. `DOCKER_FORCE_REBUILD=true` bypasses cache.
- `createDockerMcpClient()` — runs `docker run -i --rm` with volume mounts, connects through Docker's stdio pipe via `StdioClientTransport`.
- `hostToContainerPath()` — converts host absolute paths to container-relative paths (workspace mounted at `/workspace`).
- `getDockerLogs()` — extracts container logs for debugging failures.

### NPX Distribution E2E

**Files:** `tests/e2e/npx/` (2 test files: Python and JavaScript smoke tests)

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

All event simulation uses `process.nextTick()` or `setTimeout()` to defer emission, matching real async behavior.

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

**Provider:** Istanbul. **Reporters:** text, json, html, json-summary (output to `./coverage/`). `reportOnFailure: true` ensures partial coverage is captured even when tests fail.

**Excluded from coverage** (with rationale):
- Test files and type-only files (`types.ts`) — no executable logic
- CLI entry points (`cli-entry.ts`) — process-level stdio handling, not unit-testable
- Proxy entry point (`dap-proxy-entry.ts`) — runs as a separate process
- Mock adapter process (`mock-adapter-process.ts`) — tested via E2E, not importable
- Module-init side-effects (`batteries-included.ts`) — only import statements
- Barrel/index exports — prevent duplicate coverage counting
- Factory pattern files with minimal logic

**Included:** `src/**/*.{ts,js}`, `packages/**/src/**/*.{ts,js}`.

**Commands:** `npm run test:coverage` (full HTML), `npm run test:coverage:summary` (table), `npm run test:coverage:analyze` (detailed).
