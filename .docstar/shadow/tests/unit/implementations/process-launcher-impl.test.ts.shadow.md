# tests/unit/implementations/process-launcher-impl.test.ts
@source-hash: 316e318714ba76f8
@generated: 2026-02-10T00:41:35Z

## Purpose
Unit test suite for ProcessLauncherImpl and ProxyProcessLauncherImpl classes, focusing on child process management, signal handling, and proxy initialization behavior.

## Test Structure

### FakeChildProcess (L7-22)
Mock implementation of IChildProcess that extends EventEmitter with:
- Mocked `kill` and `send` methods using vi.fn()
- PassThrough stderr stream for testing
- Configurable PID for process identification

### ProcessLauncherImpl Tests (L24-100)
Tests basic process launching and signal handling:
- **Event propagation** (L37-48): Verifies child process exit events bubble up and update exit state
- **Kill fallback logic** (L50-67): Tests group kill failure fallback on Linux platforms
- **Container behavior** (L69-87): Tests direct kill when MCP_CONTAINER env var is set
- **Error handling** (L89-99): Validates false return when kill operations fail

### ProxyProcessLauncherImpl Tests (L102-254)
Tests proxy process management with initialization coordination:
- **Initialization promise** (L114-123): Tests waitForInitialization resolves on 'adapter_configured_and_launched' message
- **Early exit handling** (L125-134): Tests initialization rejection when process exits prematurely
- **Send command validation** (L136-143): Tests error throwing when child.send fails
- **Environment scrubbing** (L145-178): Validates removal of NODE_ENV, VITEST, JEST_WORKER_ID before proxy launch
- **Container detaching** (L180-199): Tests detached:false when MCP_CONTAINER is set
- **Promise reuse** (L201-218): Tests initialization promise is shared across concurrent callers
- **Kill during init** (L220-232): Tests initialization failure when killed mid-initialization
- **Pre-exit failure** (L234-241): Tests initialization failure when exit occurs before waitForInitialization call
- **Kill error handling** (L243-253): Tests false return when proxy kill throws

## Key Dependencies
- `vitest` testing framework with mocking capabilities
- Node.js `events.EventEmitter` and `stream.PassThrough` for mocking
- `@debugmcp/shared` types (IChildProcess, IProcessManager)

## Test Patterns
- Extensive environment variable cleanup in beforeEach/afterEach
- Platform-specific mocking with `vi.spyOn(global.process, 'platform')`
- Process manager mocking with spawn/exec method stubs
- Event-driven testing using child.emit() to simulate process events