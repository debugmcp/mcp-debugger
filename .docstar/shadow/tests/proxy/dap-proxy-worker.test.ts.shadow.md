# tests/proxy/dap-proxy-worker.test.ts
@source-hash: 968383526f1d4db7
@generated: 2026-02-09T18:15:27Z

## Purpose
Comprehensive test suite for `DapProxyWorker` class that validates the refactored implementation using the Adapter Policy pattern. Tests all core functionality including state management, policy selection, dry run mode, command handling, and error scenarios.

## Test Structure & Key Components

### Mock Factories (L34-90)
- `createMockLogger()` (L34): Creates ILogger mock with all logging methods
- `createMockFileSystem()` (L41): Mocks filesystem operations with default success responses  
- `createMockProcessSpawner()` (L46): Mocks process spawning returning fake ChildProcess
- `createMockDapClient()` (L56): Complex mock extending EventEmitter with DAP client interface
- `createMockMessageSender()` (L88): Simple message sender mock

### Test Setup & Teardown (L99-133)
- `beforeEach` (L99): Initializes fresh mocks and DapProxyWorker instance
- `afterEach` (L117): Cleanup with timer clearing and worker termination to prevent test interference

### Core Test Suites

#### State Management Tests (L135-173)
- Validates initialization state transitions (UNINITIALIZED → INITIALIZING → TERMINATED for dry runs)
- Tests timeout handling with fake timers

#### Policy Selection Tests (L175-254)  
- Verifies automatic adapter policy selection based on script type and adapter commands
- Tests Python policy selection when no adapter command provided (L176)
- Tests JavaScript policy for js-debug adapter (L201)
- Tests Python policy for debugpy adapter (L228)

#### Dry Run Mode Tests (L256-308)
- Validates dry run execution and command reporting without actual process spawning
- Tests error cases when adapter policy cannot provide spawn configuration

#### Hook Integration Tests (L310-395)
- Tests custom trace file factory integration during initialization (L326)
- Tests custom exit hook invocation on critical failures (L358)
- Tests that successful dry runs don't trigger exit hooks (L377)

#### Adapter Workflow Internals (L397-729)
- Complex integration tests with nested beforeEach/afterEach for worker lifecycle management
- Tests `startDebugpyAdapterAndConnect` method behavior for different policies (L419, L472)
- Tests `ensureInitialStop` timeout handling (L546, L568)
- Tests adapter process event wiring and DAP event propagation (L602)
- Tests termination and cleanup workflows (L715)

#### DAP Command Handling Tests (L731-847)
- Tests command rejection before connection establishment
- Tests command rejection during shutdown
- Tests error surfacing from adapter sendRequest failures

#### JavaScript Adapter Command Queueing (L849-922)
- Tests command queueing behavior specific to JavaScript debug adapter
- Validates policy-driven queueing decisions

#### Command Queue Management (L924-1003)
- Tests queue flushing and deferred configurationDone injection (L925)
- Tests pre-connect queue draining when connection established (L978)

#### Timeout Handling (L1005-1033)
- Tests request timeout tracking and failure response emission using fake timers

#### Error Handling (L1035-1174)
- Tests graceful handling of initialization errors with process.exit behavior
- Tests adapter spawn failure scenarios
- Tests DAP connection failure scenarios

#### Message Sending Tests (L1176-1233)
- Tests status and error message sending patterns

#### Shutdown Tests (L1235-1268)
- Tests clean shutdown behavior
- Tests multiple shutdown call handling
- Tests early return when shutdown already in progress

## Key Testing Patterns

### Mock Process.exit Pattern
Multiple tests mock `process.exit` to prevent test termination while validating exit code behavior (L890, L1053, etc.)

### Fake Timer Usage  
Strategic use of `vi.useFakeTimers()` and `vi.advanceTimersByTimeAsync()` for testing timeout scenarios (L141, L569, L1007)

### Complex Worker State Management
Tests create multiple worker instances and carefully track them for cleanup to prevent test interference (L399, L573, L852)

### Spy and Mock Restoration
Proper cleanup of spies and mocks in finally blocks to prevent test pollution (L1101, L1143)

## Dependencies & Imports
- Uses Vitest testing framework with comprehensive mocking capabilities
- Tests integration with GenericAdapterManager, DapConnectionManager  
- Validates adapter policies from @debugmcp/shared package (DefaultAdapterPolicy, JsDebugAdapterPolicy, PythonAdapterPolicy)
- Imports all necessary DAP interface types for payload construction