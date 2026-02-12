# tests\proxy/
@generated: 2026-02-12T21:05:48Z

## Proxy Module Test Suite

**Purpose:** Comprehensive test coverage for the debugmcp proxy system, which provides Debug Adapter Protocol (DAP) proxy functionality with policy-driven multi-session debugging support and adapter abstraction.

### Test Architecture Overview

This test directory validates three core components of the proxy system:

1. **DapProxyWorker** - Main orchestrator for DAP proxy operations
2. **ChildSessionManager** - Multi-session debugging abstraction  
3. **DapClientBehavior** - Policy-driven adapter behavior implementations

### Key Components and Integration

**DapProxyWorker Tests** (`dap-proxy-worker.test.ts`):
- **Core Orchestration**: Tests the main proxy workflow from initialization through termination
- **Policy Selection**: Validates JavaScript/Python/debugpy adapter detection and policy assignment
- **State Management**: Verifies UNINITIALIZED → INITIALIZING → TERMINATED transitions
- **Command Handling**: Tests DAP command routing, queueing, and error propagation
- **Process Lifecycle**: Validates adapter spawning, DAP connection establishment, and clean shutdown

**ChildSessionManager Tests** (`child-session-manager.test.ts`):
- **Multi-Session Support**: Tests child session creation and management for JavaScript debugging
- **Command Routing**: Validates policy-driven command forwarding to appropriate sessions
- **Breakpoint Mirroring**: Tests breakpoint synchronization across parent-child sessions
- **Event Forwarding**: Verifies DAP event propagation from child to parent sessions
- **Lifecycle Management**: Tests session cleanup and shutdown coordination

**DapClientBehavior Tests** (`dap-client-behavior.test.ts`):
- **Policy Implementations**: Tests JavaScript, Python, and default adapter policies
- **Reverse Request Handling**: Validates `startDebugging` and `runInTerminal` request processing
- **Configuration Management**: Tests adapter-specific settings and timeouts
- **Command Classification**: Verifies parent vs child routing decisions per policy

### Public API Surface

**Test Entry Points:**
- Policy-driven adapter behavior testing for different debug adapters
- Multi-session debugging workflow validation
- DAP protocol compliance testing
- Error handling and resilience testing

**Mock Infrastructure:**
- `MockMinimalDapClient` - Simulates DAP client for testing
- `createMockLogger/FileSystem/ProcessSpawner/DapClient/MessageSender` - Complete mock factory functions
- Policy-specific test configurations for JavaScript, Python, and default behaviors

### Internal Organization and Data Flow

**Test Data Flow:**
1. **Policy Selection** → Adapter type detection drives behavior configuration
2. **Session Management** → Child sessions created based on policy requirements  
3. **Command Routing** → Commands flow to parent or child sessions per policy rules
4. **Event Propagation** → DAP events forwarded through session hierarchy
5. **State Coordination** → Lifecycle management across all components

**Cross-Component Integration:**
- DapProxyWorker orchestrates policy selection and session management
- ChildSessionManager implements policy-specific multi-session behavior
- DapClientBehavior provides policy implementations consumed by both components

### Important Testing Patterns

**Policy-Driven Testing:** All tests validate behavior differences between JavaScript (multi-session), Python (single-session), and default (minimal) policies

**State-Based Testing:** Comprehensive state transition validation with proper setup/teardown

**Mock-Based Isolation:** Extensive mocking infrastructure prevents external dependencies while preserving realistic behavior

**Event-Driven Testing:** Validates async event handling and DAP protocol compliance

**Error Resilience Testing:** Tests failure scenarios including connection failures, timeouts, and process spawn errors

### Critical Behaviors Validated

- JavaScript policy enables child sessions, breakpoint mirroring, and complex command routing
- Python policy provides minimal single-session debugging without child management  
- Default policy offers basic DAP proxy functionality
- Proper cleanup and state management across all workflow scenarios
- DAP protocol compliance and error handling throughout the proxy pipeline