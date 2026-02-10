# tests/unit/implementations/process-launcher-impl.test.ts
@source-hash: 316e318714ba76f8
@generated: 2026-02-09T18:14:44Z

## Test file for ProcessLauncherImpl and ProxyProcessLauncherImpl implementations

This unit test file validates two process launcher implementations that manage child processes for MCP (Model Context Protocol) adapter execution.

### Test Infrastructure

- **FakeChildProcess (L7-22)**: Mock implementation of IChildProcess for testing
  - Extends EventEmitter with mocked kill/send methods
  - Provides controllable pid, streams, and event emission
  - Always initializes with stderr as PassThrough stream

### ProcessLauncherImpl Tests (L24-100)

Tests the basic process launcher that wraps child processes:

- **Event wrapping (L37-48)**: Verifies exit event forwarding and exitCode tracking
- **Group kill fallback (L50-67)**: Tests graceful degradation when process group kill fails on Linux
- **Container mode (L69-87)**: Validates direct child kill when MCP_CONTAINER env var is set
- **Error handling (L89-99)**: Ensures false return when child.kill() throws

Key patterns tested:
- Process group killing with `-pid` for non-container environments
- Environment variable detection for container contexts
- Error recovery and boolean result reporting

### ProxyProcessLauncherImpl Tests (L102-254)

Tests the advanced proxy launcher with initialization tracking:

- **Initialization resolution (L114-123)**: Validates promise resolution on adapter_configured_and_launched message
- **Early exit handling (L125-134)**: Tests rejection when process exits before initialization
- **Command sending (L136-143)**: Verifies error throwing when IPC send fails
- **Environment scrubbing (L145-178)**: Ensures test env vars (NODE_ENV, VITEST, JEST_WORKER_ID) are removed
- **Container detachment (L180-199)**: Tests process detaching disabled in containers
- **Promise reuse (L201-218)**: Validates single initialization promise for concurrent waiters
- **Kill during init (L220-232)**: Tests proper cleanup when killed during initialization
- **Pre-exit failure (L234-241)**: Handles process exit before waitForInitialization call

### Dependencies

- `@debugmcp/shared` types: IChildProcess, IProcessManager
- Node.js streams and events for mocking
- Vitest for test framework and mocking

### Architecture Notes

- Both implementations handle container vs non-container execution contexts
- ProxyProcessLauncherImpl adds IPC message handling and initialization state tracking
- Environment variable management ensures clean proxy execution
- Process group killing provides better cleanup on Unix systems