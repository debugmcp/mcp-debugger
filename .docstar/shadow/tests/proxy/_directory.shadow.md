# tests\proxy/
@children-hash: c966a332d0d6078f
@generated: 2026-02-24T01:55:00Z

## Test Suite for DAP Proxy System

**Purpose:** Comprehensive test coverage for the Debug Adapter Protocol (DAP) proxy system, validating multi-session debugging, adapter-specific policies, command routing, and edge case handling across different debugger environments.

### Test Architecture

**Mock Infrastructure Foundation:** All test files leverage sophisticated mock factories creating realistic DAP client behavior:
- `MockMinimalDapClient`: Event-driven DAP simulation with connection state tracking
- Mock filesystem, process spawning, and message communication layers
- Vitest-based dependency injection with spy capabilities for call verification

### Core Components Under Test

**DapProxyWorker (Primary Entry Point):** Main orchestrator tested in `dap-proxy-worker.test.ts`:
- State management: UNINITIALIZED → INITIALIZING → CONNECTED/TERMINATED transitions
- Adapter policy selection based on script paths and debugger types
- Dry run mode for command generation without execution
- Hook integration for custom trace factories and exit handling
- Complete DAP workflow from adapter spawn to connection establishment

**ChildSessionManager:** Multi-session debugging coordinator tested in `child-session-manager.test.ts`:
- Child session creation with event emission for new debugging targets
- Command routing logic distinguishing execution vs. initialization commands
- Breakpoint synchronization across parent-child session hierarchies
- Concurrent adoption handling with duplicate protection
- Event forwarding between session layers

**DapClientBehavior Policies:** Adapter-specific behavior implementations tested in `dap-client-behavior.test.ts`:
- **JavaScript Policy**: Full multi-session support with breakpoint mirroring and extended timeouts
- **Python Policy**: Single-session model with limited reverse request handling
- **Go/Default Policies**: Minimal implementations with basic configurations

### Specialized Test Scenarios

**Go Debugger Edge Cases (go-initialized-fallback.test.ts):** Regression testing for Delve adapter timing issues:
- Two-phase 'initialized' event handling (immediate vs. delayed arrival)
- Fallback mechanism when 'initialized' arrives only after 'launch' request
- Precise timeout validation (2s Phase 1, 10s Phase 2 total)
- Critical timing regression guards preventing timeout value drift

### Key Testing Patterns

**Policy-Driven Validation:** Tests demonstrate adapter-specific behaviors:
- Command routing rules varying by debugger type
- Session management strategies (single vs. multi-session)
- Timeout configurations and connection handling differences
- Reverse request support matrices across adapters

**State Transition Testing:** Comprehensive lifecycle validation:
- Proper initialization sequences with dependency injection
- Graceful error handling during connection failures
- Clean shutdown procedures with resource cleanup
- Idempotent operations preventing double-execution

**Timing-Sensitive Scenarios:** Advanced async behavior testing:
- Fake timer usage for precise timeout control
- Command queueing during pre-connection phases
- Event ordering verification in complex DAP sequences
- Race condition prevention in concurrent operations

### Integration Points

**Cross-Component Validation:** Tests verify proper interaction between:
- Proxy worker coordination with session managers
- Policy selection influencing command routing decisions
- Event propagation from adapter processes to parent sessions
- Error handling cascading through the proxy system layers

**External Dependencies:** Mock implementations cover:
- DAP protocol communication (`@vscode/debugprotocol`)
- Shared adapter policies (`@debugmcp/shared`)
- File system and process management interfaces
- IPC message transmission mechanisms

### Test Coverage Guarantees

The test suite provides complete validation of:
- Multi-debugger environment support (JavaScript, Python, Go)
- Complex session hierarchies with proper isolation
- Protocol compliance across different adapter implementations
- Error recovery and graceful degradation scenarios
- Performance characteristics under various timing conditions

This test directory serves as both regression protection and behavioral specification for the entire DAP proxy system, ensuring reliable debugging experiences across diverse development environments.