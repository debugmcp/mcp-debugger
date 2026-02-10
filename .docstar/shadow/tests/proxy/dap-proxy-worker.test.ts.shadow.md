# tests/proxy/dap-proxy-worker.test.ts
@source-hash: e385240be7cb7bf4
@generated: 2026-02-10T01:19:12Z

## Primary Purpose
Comprehensive test suite for `DapProxyWorker` class that validates the Debug Adapter Protocol (DAP) proxy implementation using the Adapter Policy pattern. Tests cover initialization, state management, command handling, error scenarios, and policy-specific behavior for JavaScript and Python debugging adapters.

## Test Structure & Mock Setup
- **Mock Factory Functions** (L34-90): Creates mock implementations for `ILogger`, `IFileSystem`, `IProcessSpawner`, `IDapClient`, and message sender
- **Test Fixture Setup** (L99-133): Configures test dependencies with mocked services and proper cleanup handling
- **afterEach Cleanup** (L117-133): Manages worker termination and timer cleanup to prevent test interference

## Key Test Categories

### State Management Tests (L135-173)
- **Initial State Validation** (L136-138): Verifies `UNINITIALIZED` starting state
- **State Transitions** (L140-172): Tests initialization flow with dry run mode, validates `TERMINATED` state and exit hook behavior

### Policy Selection Tests (L175-254)
- **Python Policy Selection** (L176-199): Tests automatic Python adapter policy when no adapter command provided
- **JavaScript Policy Selection** (L201-226): Validates js-debug adapter detection and policy assignment
- **Debugpy Policy Selection** (L228-253): Confirms Python debugpy adapter policy selection

### Dry Run Mode Tests (L256-308)
- **Command Reporting** (L257-286): Validates dry run execution and command string generation
- **Error Scenarios** (L288-307): Tests adapter policy failures during dry run

### Hook Integration Tests (L310-395)
- **Trace File Creation** (L326-356): Tests custom trace file factory hook integration
- **Exit Hook Invocation** (L358-375): Validates exit hook behavior on critical failures
- **Successful Dry Run** (L377-394): Confirms exit hook is not triggered during successful operations

### Adapter Workflow Internals (L397-729)
- **Connection Flow** (L419-470): Tests adapter startup and connection for queueing policies (JavaScript)
- **Session Initialization** (L472-544): Validates non-queueing policy initialization flow (Python)
- **Initial Stop Handling** (L546-600): Tests thread detection and pause functionality
- **Event Propagation** (L602-713): Validates adapter process events and DAP event forwarding
- **Termination Handling** (L715-728): Tests proper shutdown of client and process components

### DAP Command Handling Tests (L731-847)
- **Pre-connection Rejection** (L732-773): Validates command rejection before connection establishment
- **Shutdown State Handling** (L775-814): Tests command rejection during shutdown
- **Error Propagation** (L816-846): Validates adapter error surfacing through sendRequest failures

### Command Queueing Tests (L849-1003)
- **JavaScript Adapter Queueing** (L850-922): Tests command queueing behavior for JavaScript debugging
- **Queue Draining** (L924-976): Validates queued command execution and deferred configurationDone injection
- **Pre-connect Queue** (L978-1002): Tests command queueing before connection establishment

### Timeout & Error Handling (L1005-1174)
- **Request Timeouts** (L1006-1033): Tests tracked request timeout handling and failure responses
- **Initialization Errors** (L1035-1105): Validates graceful handling of filesystem and spawn failures
- **Connection Failures** (L1107-1173): Tests DAP connection error handling and exit behavior

### Message Communication Tests (L1176-1233)
- **Status Messages** (L1177-1201): Validates status message sending during operations
- **Error Messages** (L1203-1232): Tests error message generation for invalid operations

### Shutdown Tests (L1235-1268)
- **Clean Shutdown** (L1236-1246): Validates proper termination and status reporting
- **Multiple Shutdown Calls** (L1248-1257): Tests idempotent shutdown behavior
- **Shutdown State Management** (L1259-1267): Validates early return for in-progress shutdowns

## Key Dependencies
- **External**: `vitest`, `events.EventEmitter`, `child_process`, `path`
- **Internal**: `DapProxyWorker`, `GenericAdapterManager`, `DapConnectionManager`, adapter policies
- **Shared**: `@debugmcp/shared` adapter policy implementations

## Testing Patterns
- Extensive use of `vi.useFakeTimers()` for timeout testing
- Mock process.exit to prevent test termination during error scenarios
- Proper cleanup with timer clearing and worker termination
- Event emitter simulation for adapter process and DAP client interactions