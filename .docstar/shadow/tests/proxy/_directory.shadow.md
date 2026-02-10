# tests/proxy/
@generated: 2026-02-10T01:19:44Z

## Tests for Debugging Proxy Infrastructure

**Purpose:** Comprehensive test suite for the debugmcp proxy system, which provides multi-session Debug Adapter Protocol (DAP) proxy capabilities with policy-driven behavior for different adapter types (JavaScript, Python).

### Core Testing Focus

**DapProxyWorker Testing (dap-proxy-worker.test.ts):** Primary orchestration tests covering the main proxy worker implementation:
- Worker lifecycle management (initialization, state transitions, termination)
- Adapter policy selection and configuration for different debugger types
- DAP client connection management and command queueing
- Error handling, timeouts, and graceful shutdown procedures
- Hook integration for trace file creation and exit callbacks
- Message communication and status reporting

**ChildSessionManager Testing (child-session-manager.test.ts):** Multi-session debugging scenario validation:
- Child session creation and lifecycle management for JavaScript debugging
- Command routing between parent and child sessions based on adapter policy
- Breakpoint mirroring functionality for multi-target scenarios
- Event forwarding and state synchronization across sessions
- Policy-specific behavior validation (JavaScript vs Python session handling)

**DapClientBehavior Testing (dap-client-behavior.test.ts):** Adapter policy behavior validation:
- Reverse request handling (`startDebugging`, `runInTerminal`) across different policies
- Command routing configuration for execution vs initialization commands
- Adapter-specific timeout and configuration settings
- Cross-policy behavioral comparison and uniqueness validation

### Key System Components Under Test

**Proxy Infrastructure:**
- `DapProxyWorker` - Main orchestration component with state management
- `ChildSessionManager` - Multi-session debugging abstraction
- `DapClientBehavior` implementations - Policy-driven DAP client behavior

**Adapter Policies:**
- `JsDebugAdapterPolicy` - Multi-session JavaScript debugging with child session support
- `PythonAdapterPolicy` - Single-session Python debugging with limited child support
- `DefaultAdapterPolicy` - Fallback behavior with minimal functionality

**Support Infrastructure:**
- Connection managers, process spawners, file system abstractions
- Mock implementations for isolated unit testing
- Event-driven communication patterns

### Testing Patterns and Infrastructure

**Mock Strategy:**
- Comprehensive mock factories for DAP clients, file systems, and process spawners
- Event emitter simulation for adapter processes and DAP communication
- Vitest-based mocking with proper cleanup and isolation

**Test Organization:**
- State management and lifecycle testing
- Policy selection and configuration validation
- Command handling, queueing, and routing verification
- Error scenarios and timeout handling
- Cross-policy behavioral comparison

**Key Testing Behaviors:**
- Async session creation with event-driven validation
- Command queueing for connection-dependent adapters (JavaScript)
- Request/response tracking with timeout handling
- Multi-session breakpoint synchronization
- Graceful error handling and shutdown procedures

### Integration Points

The test suite validates the complete proxy system workflow:
1. **Initialization** - Worker startup, policy selection, adapter configuration
2. **Connection Management** - DAP client connection with policy-specific behavior
3. **Session Management** - Single vs multi-session handling based on adapter type
4. **Command Processing** - Request routing, queueing, and response handling
5. **Error Handling** - Timeout management, connection failures, graceful degradation
6. **Shutdown** - Clean termination of all sessions and connections

This testing infrastructure ensures the proxy system can reliably handle diverse debugging scenarios while maintaining policy-driven behavior separation across different adapter types.