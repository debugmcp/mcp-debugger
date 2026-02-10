# tests/proxy/
@generated: 2026-02-10T21:26:16Z

## Proxy Testing Module

**Purpose:** Comprehensive test suite for the debugmcp proxy system, validating DAP (Debug Adapter Protocol) proxy functionality, multi-session debugging, and adapter policy implementations.

### Test Module Components

The test directory covers three critical aspects of the proxy system:

**ChildSessionManager Testing** (`child-session-manager.test.ts`): Validates multi-session debugging abstractions with policy-driven child session management. Tests JavaScript policy's complex multi-session behavior (child session creation, command routing, breakpoint mirroring) against Python policy's simpler single-session approach.

**DAP Client Behavior Testing** (`dap-client-behavior.test.ts`): Comprehensive validation of adapter policy implementations (JavaScript, Python, Default, Mock) focusing on reverse request handling, command routing configuration, and adapter-specific behavioral differences.

**Proxy Worker Integration Testing** (`dap-proxy-worker.test.ts`): End-to-end testing of the main DapProxyWorker class covering complete workflow scenarios from initialization through termination, including state management, policy selection, error handling, and message passing.

### Key Testing Patterns

**Mock Infrastructure**: Sophisticated mocking strategy using Vitest with complete DAP client simulation, process spawning mocks, and EventEmitter preservation for realistic event-driven testing.

**Policy-Driven Testing**: Validates adapter-specific behaviors across different debugging contexts:
- JavaScript: Complex multi-session with child routing and breakpoint mirroring
- Python: Single-session with minimal child session support  
- Default: Fallback behavior with basic functionality

**State Management Validation**: Comprehensive testing of proxy lifecycle transitions (UNINITIALIZED → INITIALIZING → TERMINATED) with proper cleanup and error handling.

### Critical Test Coverage Areas

**Multi-Session Debugging**: Child session creation, command routing logic, breakpoint synchronization, and concurrent session management with duplicate protection.

**Command Processing**: DAP command queuing, routing decisions, timeout handling, and error propagation across different adapter policies.

**Workflow Integration**: Complete adapter startup sequences, DAP connection establishment, session initialization patterns, and clean termination procedures.

**Error Resilience**: File system failures, adapter spawn errors, connection timeouts, and graceful degradation scenarios.

### Dependencies & Integration Points

- **Protocol Compliance**: `@vscode/debugprotocol` for DAP type validation
- **Shared Components**: `@debugmcp/shared` for adapter policies and interfaces
- **Testing Framework**: Vitest with advanced mocking, fake timers, and event simulation

### Public Test API Surface

The test suite validates the proxy module's main entry points:
- `ChildSessionManager` class for multi-session abstractions
- `DapClientBehavior` implementations for policy-specific behaviors
- `DapProxyWorker` as the primary orchestration component

This testing module ensures the proxy system correctly handles complex debugging scenarios across different language adapters while maintaining protocol compliance and robust error handling.