# tests\proxy/
@children-hash: 82ef5301495473b3
@generated: 2026-02-15T09:01:27Z

## Tests Directory for DAP Proxy System

**Purpose:** Comprehensive test suite for the debugmcp proxy system, which implements a Debug Adapter Protocol (DAP) proxy with multi-session debugging capabilities and policy-driven adapter behavior management.

### System Under Test

The proxy system consists of three core components tested here:

1. **DapProxyWorker** - Main orchestrator managing adapter lifecycle, policy selection, and message routing
2. **ChildSessionManager** - Handles multi-session debugging scenarios with policy-driven child session management  
3. **DapClientBehavior** - Policy implementations defining adapter-specific behaviors for JavaScript, Python, and other debuggers

### Test Architecture & Coverage

**State Management & Lifecycle Testing:**
- Worker state transitions (UNINITIALIZED → INITIALIZING → TERMINATED)
- Clean shutdown sequences with proper resource cleanup
- Error handling during initialization and runtime failures
- Hook integration for custom trace factories and exit handlers

**Policy-Driven Behavior Validation:**
- **JavaScript/Node.js Policy**: Multi-session support with child session creation, command routing, and breakpoint mirroring
- **Python Policy**: Single-session debugging with limited reverse request handling
- **Default/Fallback Policies**: Minimal behavior for unsupported adapters
- Cross-policy comparison ensuring behavioral uniqueness

**Multi-Session Debugging Features:**
- Child session creation triggered by `startDebugging` reverse requests
- Command routing logic separating parent commands (initialize, launch) from child commands (threads, evaluate)
- Breakpoint synchronization across parent and child debugging sessions
- Event forwarding between session hierarchies

**DAP Protocol Integration:**
- Request/response handling with proper error propagation
- Command queueing for adapters requiring deferred initialization
- Reverse request processing (runInTerminal, startDebugging)
- Protocol message validation and state-aware command rejection

### Key Testing Patterns

**Mock Infrastructure:** Comprehensive mocking of external dependencies including file system, process spawning, DAP clients, and IPC message senders while preserving EventEmitter behavior for realistic event testing.

**Async Workflow Testing:** Extensive use of fake timers for deterministic async operation testing, Promise-based session creation, and timeout handling validation.

**Policy Isolation:** Independent test suites for each adapter policy ensuring behavioral boundaries and preventing cross-contamination between debugging scenarios.

**Error Resilience:** Systematic testing of failure modes including connection timeouts, spawn failures, file system errors, and protocol violations with proper error propagation verification.

### Integration Points

The test suite validates the complete proxy workflow from adapter policy selection through DAP connection establishment, session management, command routing, and clean termination. Tests ensure the system properly handles both simple single-session debugging and complex multi-session scenarios with parent-child session hierarchies.

The comprehensive coverage includes Windows-specific IPC handling, dry-run mode validation, and cross-platform compatibility patterns, ensuring the proxy system functions reliably across different development environments and debugging scenarios.