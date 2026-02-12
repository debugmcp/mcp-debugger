# tests\proxy/
@generated: 2026-02-12T21:00:56Z

## Proxy Module Test Suite

**Purpose:** Comprehensive test coverage for the DAP (Debug Adapter Protocol) proxy system that enables multi-session debugging through policy-driven adapter management. This directory validates the core proxy functionality, child session management, and adapter-specific behaviors across different debugging contexts.

### Key Components and Integration

**DapProxyWorker Tests (`dap-proxy-worker.test.ts`):** Primary orchestrator tests covering the complete proxy lifecycle:
- State management (UNINITIALIZED → INITIALIZING → TERMINATED transitions)
- Policy selection based on adapter type (JavaScript, Python, debugpy)
- Adapter process spawning and DAP connection establishment
- Command queueing and routing mechanisms
- Error handling and graceful termination workflows
- IPC message passing and status reporting

**ChildSessionManager Tests (`child-session-manager.test.ts`):** Multi-session debugging validation:
- JavaScript policy: Child session creation, command routing, breakpoint mirroring, concurrent adoption handling
- Python policy: Single-session behavior validation (no child routing or breakpoint mirroring)
- Event forwarding between parent and child sessions
- Session lifecycle management and cleanup

**DapClientBehavior Tests (`dap-client-behavior.test.ts`):** Policy-specific behavior validation:
- Reverse request handling (`startDebugging`, `runInTerminal`)
- Command routing configuration (child vs parent routing)
- Adapter-specific settings and timeout configurations
- Cross-policy behavioral comparisons

### System Architecture Validation

The test suite validates a three-tier architecture:
1. **Policy Layer:** Adapter-specific behaviors (JsDebugAdapterPolicy, PythonAdapterPolicy, DefaultAdapterPolicy)
2. **Session Management:** ChildSessionManager for multi-session orchestration
3. **Worker Orchestration:** DapProxyWorker as the primary coordinator

### Key Testing Patterns

**Mock Infrastructure:** Comprehensive mocking system including:
- Mock DAP clients with EventEmitter preservation
- File system and process spawning mocks
- IPC message sender mocks
- Standardized mock factory functions for consistent test setup

**State Transition Testing:** Validates complex async workflows with proper state management and error propagation across the proxy system.

**Policy-Driven Testing:** Ensures adapter-specific behaviors are correctly implemented and isolated, with cross-policy comparison validation.

**Event-Driven Validation:** Tests the complete event propagation chain from child sessions through the proxy to parent contexts.

### Public API Coverage

The tests validate the complete public interface of the proxy system:
- Proxy worker initialization and termination
- DAP command routing and response handling  
- Multi-session debugging capabilities
- Adapter policy selection and configuration
- Error handling and status reporting
- IPC communication patterns

### Critical Behaviors Tested

- **JavaScript Multi-Session Support:** Child session creation, breakpoint mirroring, command routing
- **Python Single-Session Mode:** Simplified debugging without child session complexity  
- **Dry-Run Mode:** Command generation without actual process execution
- **Error Resilience:** Initialization failures, connection timeouts, spawn errors
- **Clean Shutdown:** Proper resource cleanup and session termination
- **Command Queueing:** Policy-specific command deferral and execution patterns

This test suite ensures the proxy system can reliably handle complex debugging scenarios across different language adapters while maintaining proper isolation and resource management.