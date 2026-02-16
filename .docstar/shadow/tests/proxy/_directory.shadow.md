# tests\proxy/
@children-hash: 73a2f8be97169138
@generated: 2026-02-16T08:24:30Z

## Test Suite for DAP Proxy System

**Purpose:** Comprehensive test coverage for the Debug Adapter Protocol (DAP) proxy system, validating the multi-session debugging architecture, adapter policy pattern, and session management infrastructure.

### Key Components and Architecture

**DapProxyWorker Tests (`dap-proxy-worker.test.ts`):** Core proxy worker validation covering:
- State management (UNINITIALIZED → INITIALIZING → TERMINATED transitions)
- Adapter policy selection based on script paths and adapter types
- Dry run mode execution with command generation
- DAP command lifecycle from queueing through execution
- Error handling for initialization failures, spawn errors, and connection failures
- Shutdown behavior and cleanup mechanisms

**ChildSessionManager Tests (`child-session-manager.test.ts`):** Multi-session debugging abstraction validation:
- JavaScript policy: Child session creation, command routing, breakpoint mirroring, event forwarding
- Python policy: Single-session behavior with no child routing
- Policy-driven session lifecycle management and cleanup
- Concurrent adoption handling with duplicate protection

**DapClientBehavior Tests (`dap-client-behavior.test.ts`):** Adapter policy behavior validation:
- Cross-policy comparison of reverse request handling (`startDebugging`, `runInTerminal`)
- Command routing configuration (child-routed vs parent-only commands)
- Adapter-specific settings (timeouts, session management flags)
- Policy-specific behavioral patterns and constraints

### Testing Infrastructure

**Mock Architecture:**
- `MockMinimalDapClient`: EventEmitter-based DAP client simulation with request tracking
- Comprehensive mock factories for logger, filesystem, process spawner, and message sender
- Vitest-based mocking with fake timers for async behavior control
- Policy-specific mock implementations for isolated testing

**Test Patterns:**
- Event-driven testing with spies and listeners
- State transition validation through lifecycle methods
- Policy behavior comparison across adapter types
- Mock request/response tracking for command verification
- Async session creation with Promise handling
- Error scenario simulation with process.exit mocking

### Public API Coverage

**Core Entry Points Tested:**
- `DapProxyWorker` - Main proxy worker with initialization, command handling, and shutdown
- `ChildSessionManager` - Multi-session abstraction with policy-driven behavior
- Adapter policies (`JsDebugAdapterPolicy`, `PythonAdapterPolicy`, `DefaultAdapterPolicy`) - Behavioral configuration

**Key Interfaces Validated:**
- DAP command routing and queueing mechanisms
- Reverse request handling for session creation
- Breakpoint mirroring and synchronization
- Event propagation between parent and child sessions
- Policy-specific timeout and configuration management

### Internal Organization

**Data Flow Testing:**
- Command queue management from pre-connection through execution
- Event forwarding from adapter processes to parent sessions
- Session lifecycle from creation through cleanup
- Policy selection based on script analysis and adapter identification
- Error propagation and graceful degradation handling

**Integration Points:**
- Process spawner integration with adapter executable management
- DAP client connection establishment and maintenance
- IPC communication with message sender validation
- File system integration for trace file management
- Hook system for custom behavior injection

This test suite provides comprehensive coverage of the proxy system's multi-session debugging capabilities, ensuring reliable policy-driven session management and robust error handling across different adapter types.