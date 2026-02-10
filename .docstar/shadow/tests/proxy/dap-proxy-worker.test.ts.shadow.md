# tests/proxy/dap-proxy-worker.test.ts
@source-hash: 6d7838ae3aebfd9e
@generated: 2026-02-10T21:25:47Z

## DapProxyWorker Unit Tests

Comprehensive unit tests for the DAP (Debug Adapter Protocol) proxy worker implementation using the Adapter Policy pattern. Tests critical workflow scenarios, state management, policy selection, error handling, and message passing.

### Test Structure & Setup

**Mock Factory Functions (L34-91)**: Creates standardized mocks for all DapProxyWorker dependencies:
- `createMockLogger()` (L34): Returns ILogger mock with info/error/debug/warn methods
- `createMockFileSystem()` (L41): Mocks ensureDir and pathExists operations
- `createMockProcessSpawner()` (L46): Returns process spawn mock with PID tracking
- `createMockDapClient()` (L56): Complex EventEmitter wrapper preserving event handling while mocking DAP client methods
- `createMockMessageSender()` (L88): Simple send method mock for IPC

**Test Configuration (L99-115)**: Shared setup creating DapProxyWorker with mocked dependencies, proper cleanup ensuring no test interference.

### Core Test Categories

**State Management Tests (L135-173)**: 
- Verifies UNINITIALIZED → INITIALIZING → TERMINATED state transitions
- Tests dry-run mode termination behavior with Windows IPC compatibility fixes
- Validates exit hook invocation timing (L168-169)

**Policy Selection Tests (L175-254)**:
- JavaScript adapter detection via command arguments (L201-226)
- Python adapter fallback when no adapter command provided (L176-199)  
- debugpy adapter recognition (L228-253)
- Logs selected policy for debugging (L223-225, L249-252)

**Dry Run Mode Tests (L256-308)**:
- Command generation and reporting without actual process spawn (L257-286)
- Error handling when adapter policy cannot provide spawn configuration (L288-307)
- Status message verification for dry-run completion

**Hook Integration Tests (L310-402)**:
- Custom trace file factory usage during initialization (L326-356)
- Exit hook invocation on critical initialization failures (L358-382)
- Windows IPC flush pattern testing with fake timers (L374-375)

### Advanced Workflow Tests

**Adapter Workflow Internals (L404-736)**:
- Complete adapter startup and DAP connection flow (L426-477)
- Session initialization for queueing vs non-queueing policies (L479-551)
- Initial thread pausing mechanism (L553-607) 
- Adapter process event handling and DAP event propagation (L609-720)
- Clean termination sequence testing (L722-735)

**DAP Command Handling Tests (L738-854)**:
- Command rejection before connection establishment (L739-780)
- Command rejection during shutdown state (L782-821)
- Error surfacing from adapter sendRequest failures (L823-853)

**JavaScript Adapter Command Queueing (L856-929)**:
- Policy-specific command queueing behavior for js-debug adapter
- Queue vs immediate execution based on connection state
- Complex setup with multiple worker instances for isolation

**Command Queue Management (L931-1010)**:
- Deferred configurationDone injection for queueing policies (L932-983)
- Pre-connect command queue draining (L985-1010)
- Policy-driven queue behavior verification

### Error Handling & Resilience

**Initialization Error Tests (L1042-1171)**:
- File system permission failures triggering process exit (L1043-1077)
- Adapter spawn failures with exit hook invocation (L1079-1124)
- DAP connection failures with proper error propagation (L1126-1171)

**Timeout Handling (L1012-1040)**:
- Request tracker timeout detection and error response generation
- Fake timer usage for deterministic timeout testing

**Message Sending Tests (L1201-1258)**:
- Status message format verification
- Error message generation for invalid states
- Proper sessionId propagation in messages

**Shutdown Tests (L1260-1293)**:
- Clean termination with status message emission
- Multiple shutdown call handling (idempotency)
- State transition verification during shutdown

### Key Testing Patterns

- Extensive use of `vi.useFakeTimers()` for controlling async operations
- Mock exit hooks to prevent test process termination
- Complex EventEmitter mocking preserving real event behavior
- State assertion throughout workflow transitions
- Message sender call verification for IPC testing
- Proper cleanup in afterEach hooks preventing test interference