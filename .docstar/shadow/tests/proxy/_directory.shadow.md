# tests/proxy/
@generated: 2026-02-11T23:47:40Z

## Test Suite for DAP Proxy System

**Purpose:** Comprehensive test coverage for the DebugMCP proxy system that implements policy-driven debugging adapters using the Debug Adapter Protocol (DAP). Tests validate multi-session debugging capabilities, adapter policy behaviors, and proxy worker lifecycle management.

### Key Components and Integration

**DapProxyWorker Tests (`dap-proxy-worker.test.ts`):** Core integration tests for the main proxy worker orchestrating the entire debugging pipeline:
- State machine validation (UNINITIALIZED → INITIALIZING → TERMINATED)
- Policy selection logic based on adapter types (JavaScript, Python, debugpy)
- Adapter process spawning and DAP connection management
- Command queueing and routing through policy implementations
- Error handling, timeouts, and clean shutdown sequences

**ChildSessionManager Tests (`child-session-manager.test.ts`):** Validates multi-session debugging abstractions:
- Child session creation and lifecycle management
- Command routing between parent and child debug sessions
- Breakpoint mirroring across debugging contexts
- Event forwarding and session coordination
- Policy-specific behaviors (JavaScript supports children, Python does not)

**DapClientBehavior Tests (`dap-client-behavior.test.ts`):** Policy implementation validation focusing on adapter-specific behaviors:
- JavaScript policy: Child session support, command routing, breakpoint mirroring
- Python policy: Single-session debugging with terminal support only
- Reverse request handling (`startDebugging`, `runInTerminal`)
- Adapter ID normalization and timeout configurations

### System Architecture Flow

1. **Policy Selection:** DapProxyWorker analyzes adapter commands to select appropriate policy (JS/Python/Default)
2. **Session Management:** ChildSessionManager handles multi-session scenarios based on policy capabilities
3. **Command Routing:** DapClientBehavior implementations route commands between parent/child sessions
4. **Event Coordination:** Events flow from adapter through proxy to debugging clients with policy-driven transformations

### Testing Infrastructure

**Mock Framework:** Extensive mock infrastructure simulating:
- DAP clients with EventEmitter behavior preservation
- File system operations and process spawning
- Message passing and IPC communication
- Adapter lifecycle and connection management

**Test Patterns:**
- Event-driven testing with spies and async Promise handling
- State transition verification throughout component lifecycles
- Policy-specific behavior validation across adapter types
- Error injection and resilience testing
- Timeout simulation using fake timers

### Key Adapter Policies

**JavaScript Policy:** Full multi-session support with child debugging, breakpoint mirroring, command queueing, and extended timeouts (12s)

**Python Policy:** Single-session debugging with terminal operation support and shorter timeouts (5s)

**Default/Mock Policies:** Minimal implementations for fallback scenarios and testing isolation

### Public API Surface

The test suite validates the proxy system's ability to:
- Accept DAP commands and route them based on active policy
- Manage debugging sessions across multiple targets/processes
- Handle reverse requests from adapters (`startDebugging`, `runInTerminal`)
- Provide status and error reporting through IPC messages
- Maintain session state consistency during startup, execution, and shutdown phases

### Critical Behaviors Tested

- **Session Lifecycle:** Creation, initialization, active debugging, and clean termination
- **Command Processing:** Pre-connection queueing, routing logic, and error propagation
- **Policy Enforcement:** Adapter-specific behaviors and capability restrictions
- **Error Recovery:** Timeout handling, connection failures, and graceful degradation
- **Concurrency:** Multiple session management and duplicate request prevention