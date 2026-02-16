# tests\proxy\dap-proxy-worker.test.ts
@source-hash: 852c8f9ae1b8afd6
@generated: 2026-02-16T08:24:08Z

## Purpose
Comprehensive unit tests for DapProxyWorker, validating the refactored implementation using the Adapter Policy pattern. Tests state management, policy selection, dry run mode, DAP command handling, error scenarios, and shutdown behaviors.

## Key Test Structure

### Mock Factories (L35-92)
- `createMockLogger()` (L35): Creates mock ILogger with vitest spies for all log methods
- `createMockFileSystem()` (L42): Mock IFileSystem with ensureDir/pathExists methods
- `createMockProcessSpawner()` (L47): Mock IProcessSpawner returning mock ChildProcess
- `createMockDapClient()` (L57): Complex EventEmitter-based mock preserving original event methods while adding vitest spies
- `createMockMessageSender()` (L89): Mock message sender for IPC communication

### Test Setup (L100-134)
- `beforeEach` initializes fresh worker instance with all mocked dependencies
- `afterEach` ensures proper cleanup with timer clearing and worker termination

## Test Categories

### State Management (L136-174)
- Tests UNINITIALIZED → INITIALIZING → TERMINATED state transitions
- Validates dry run execution with process exit mocking

### Policy Selection (L176-255)
- Tests automatic policy detection based on script path and adapter command
- Validates Python policy for .py files and debugpy adapter (L229)
- Validates JavaScript policy for js-debug adapter (L202)

### Dry Run Mode (L257-309)
- Tests command generation and reporting for dry run spawns
- Tests error handling when adapter policy cannot provide spawn config (L289)

### Hook Integration (L311-403)
- Tests custom trace file factory during initialization (L327)
- Tests exit hook invocation on critical failures (L359)
- Tests Windows IPC fix timer behavior with fake timers

### Adapter Workflow Internals (L405-839)
- Complex workflow tests with process/connection manager stubs
- Tests `startAdapterAndConnect` for queueing policies (L427) and non-queueing policies (L480)
- Tests Go/Delve-specific launch-before-configurationDone behavior (L554)
- Tests `ensureInitialStop` thread detection and pausing (L656)
- Tests event propagation from adapter process to parent (L712)

### DAP Command Handling (L841-957)
- Tests command rejection before connection established
- Tests command rejection during shutdown
- Tests adapter error surfacing when sendRequest fails

### JavaScript Adapter Queueing (L959-1032)
- Tests pre-connection command queueing for JS adapter policy
- Validates policy-specific command handling behavior

### Command Queue Management (L1034-1143)
- Tests queue draining with deferred configurationDone injection (L1035)
- Tests pre-connect queue handling when connection established (L1088)
- Tests request timeout handling with fake timers (L1115)

### Error Handling (L1145-1302)
- Tests graceful handling of initialization failures with process.exit
- Tests adapter spawn failure handling (L1182)
- Tests DAP connection failure handling (L1229)

### Message Sending (L1304-1361)
- Tests status message transmission
- Tests error message formatting and delivery

### Shutdown (L1363-1396)
- Tests clean termination with state transitions
- Tests idempotent shutdown behavior
- Tests early return when shutdown already in progress

## Key Dependencies
- Imports from `../../src/proxy/` (DapProxyWorker, managers, interfaces)
- Uses `@debugmcp/shared` adapter policies (DefaultAdapterPolicy, JsDebugAdapterPolicy, etc.)
- Extensive use of vitest mocking and fake timers for async behavior control

## Testing Patterns
- Heavy use of `vi.useFakeTimers()` for controlling async timing behavior
- Mock process.exit to prevent test suite termination during error scenarios
- EventEmitter simulation for DAP client event handling
- State inspection through private method access with `(worker as any)`
- Cleanup tracking with `currentWorker` variable for proper test isolation