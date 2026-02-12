# tests/unit/proxy/
@generated: 2026-02-11T23:47:50Z

## Purpose and Scope

The `tests/unit/proxy` directory contains comprehensive unit tests for the Debug Adapter Protocol (DAP) proxy subsystem. This test suite validates the core functionality that enables MCP (Model Context Protocol) to bridge debug sessions between clients and Python debug adapters. The tests ensure robust connection management, message parsing, request tracking, process lifecycle management, and error handling for debugging workflows.

## Key Components and Architecture

### Core Proxy Management (`proxy-manager.*` tests)
- **ProxyManager**: Central orchestrator for proxy processes and DAP communication lifecycle
- **Handshake & Initialization**: Connection establishment with retry logic and timeout handling
- **Message Handling**: Bidirectional communication between clients and debug adapters
- **Process Lifecycle**: Startup, shutdown, and error recovery scenarios
- **Branch Coverage**: Edge cases and less common execution paths

### Connection Infrastructure (`dap-proxy-connection-manager.test.ts`)
- **DapConnectionManager**: Core DAP client connection orchestration with exponential backoff retry logic
- **Session Management**: DAP initialize requests, event handler setup, and graceful disconnection
- **Breakpoint Management**: Setting, validation, and synchronization of breakpoints
- **Concurrency Handling**: Multiple simultaneous connections and rapid disconnect/reconnect cycles

### Message Processing (`dap-proxy-message-parser.test.ts`, `dap-proxy-request-tracker.test.ts`)
- **MessageParser**: Command parsing and validation for init, DAP, and terminate payloads
- **RequestTracker**: Request lifecycle management with timeout handling and callback mechanisms
- **Protocol Validation**: Comprehensive validation of DAP message structures and formats

### DAP Client Implementation (`minimal-dap.test.ts`)
- **MinimalDapClient**: Low-level DAP communication with network socket management
- **Message Assembly**: Multi-chunk message parsing and protocol frame handling
- **Child Session Management**: Hierarchical session creation and request routing
- **Event Handling**: DAP event forwarding and response correlation

### Utility Functions (`orphan-check.test.ts`)
- **Process Orphan Detection**: Container-aware process lifecycle management
- **Environment Validation**: Runtime environment checks and cleanup logic

## Test Infrastructure and Patterns

### Mock Architecture
- **Comprehensive Mocking**: Network sockets, file systems, loggers, and process launchers
- **Event Simulation**: EventEmitter-based testing for async communication flows
- **Timer Control**: Fake timers for deterministic timeout and retry logic testing
- **State Management**: Type casting to access private members for state verification

### Testing Strategies
- **Concurrent Operation Testing**: Multiple simultaneous connections and operations
- **Error Injection**: Strategic failure scenarios for resilience validation
- **Edge Case Coverage**: Boundary conditions, malformed data, and race conditions
- **Timeout Scenarios**: Comprehensive timeout handling with controlled timing

### Test Utilities
- **TestProxyManager**: Simplified proxy manager avoiding real process spawning
- **Helper Functions**: Message creation, buffer manipulation, and mock setup utilities
- **Custom Handlers**: Specialized error handling for timeout test scenarios

## Public API Surface

### Primary Entry Points
- **ProxyManager.start()**: Main proxy initialization and startup
- **ProxyManager.sendCommand()**: DAP command dispatch to debug adapter
- **DapConnectionManager.connectWithRetry()**: Connection establishment with retry logic
- **MessageParser.parseCommand()**: Command parsing and validation
- **MinimalDapClient**: Direct DAP protocol communication

### Configuration Interfaces
- **ProxyConfig**: Session configuration including adapter paths and debug settings
- **Initialization Payloads**: Session setup with breakpoints, arguments, and debug flags
- **Connection Parameters**: Host, port, timeout, and retry configuration

## Internal Organization and Data Flow

### Message Flow Architecture
1. **Command Reception**: Raw commands parsed and validated by MessageParser
2. **Request Tracking**: RequestTracker manages pending requests with timeouts
3. **Connection Management**: DapConnectionManager handles adapter connections
4. **Protocol Communication**: MinimalDapClient manages low-level DAP messaging
5. **Response Correlation**: Responses matched to requests via sequence numbers

### Session Lifecycle
1. **Proxy Startup**: Process launch and initialization handshake
2. **Adapter Connection**: DAP client connection with retry logic
3. **Session Configuration**: Debug adapter setup with breakpoints and settings
4. **Active Debugging**: Request/response cycles and event handling
5. **Cleanup**: Graceful shutdown with pending request cleanup

## Important Patterns and Conventions

### Error Handling
- **Retry Logic**: Exponential backoff with configurable max attempts (typically 60)
- **Timeout Management**: Consistent timeout patterns (30s initialization, 1s disconnect)
- **Graceful Degradation**: Fallback behaviors for communication failures

### Concurrency Management
- **Request Correlation**: Sequence number-based request/response matching
- **State Protection**: Prevention of concurrent startup/shutdown operations
- **Race Condition Handling**: Proper cleanup during rapid state transitions

### Testing Standards
- **Deterministic Timing**: Fake timers for reliable async behavior testing
- **Comprehensive Mocking**: Full dependency injection with mock validation
- **Edge Case Coverage**: Extensive boundary condition and error scenario testing

This test suite ensures the proxy subsystem can reliably manage debug sessions, handle network failures, parse complex protocol messages, and maintain state consistency across concurrent operations.