# tests/unit/proxy/
@generated: 2026-02-10T01:19:45Z

## Overall Purpose
Unit test suite for the **Debug Adapter Protocol (DAP) proxy system** - a critical component that enables debugging session management with connection pooling, retry logic, and message routing between debug clients and Python debuggers. The proxy acts as an intermediary layer handling complex DAP communication patterns including session initialization, breakpoint management, and child session orchestration.

## Key Components & Architecture

### Core Proxy Classes (Primary Test Targets)
- **`ProxyManager`**: Main orchestrator handling proxy process lifecycle, initialization, and command routing
- **`DapConnectionManager`**: Manages DAP client connections with retry logic and event handling
- **`MessageParser`**: Validates and parses proxy commands (init/dap/terminate payloads)
- **`RequestTracker`**: Tracks pending DAP requests with timeout management and callback support
- **`MinimalDapClient`**: Low-level DAP protocol client with message parsing and child session support

### Supporting Components
- **Orphan process utilities**: Container-aware process cleanup for abandoned proxy sessions
- **Test infrastructure**: Mock factories, fake timers, and async coordination helpers

## Public API Surface & Entry Points

### Primary Management Interface
- `ProxyManager.start()`: Initializes proxy process with retry logic and environment validation
- `ProxyManager.sendInitWithRetry()`: Handshake protocol with exponential backoff (500ms-8000ms intervals)
- `ProxyManager.sendCommand()`: Routes DAP commands with request/response correlation

### Connection Management
- `DapConnectionManager.connectWithRetry()`: Establishes DAP connections with 60-attempt retry limit
- `DapConnectionManager.initializeSession()`: Python adapter configuration
- `DapConnectionManager.setBreakpoints()`: Breakpoint synchronization across sessions

### Message Processing
- `MessageParser.parseCommand()`: Validates init/dap/terminate commands from JSON/object input
- `MinimalDapClient`: Direct DAP protocol communication with event forwarding

## Internal Organization & Data Flow

### Initialization Flow
1. **Proxy Launch**: Process spawning with script resolution across deployment patterns
2. **Handshake Protocol**: Init command with retry/timeout (30s max)
3. **DAP Connection**: Client connection establishment with exponential backoff
4. **Session Setup**: Python adapter initialization and breakpoint configuration

### Message Routing Architecture
```
Client → ProxyManager → MessageParser → DapConnectionManager → MinimalDapClient → Python Debugger
                    ↓                                        ↓
               RequestTracker ←→ Timeout Management      Event Forwarding
```

### State Management
- **Request Correlation**: Sequence-number based request/response matching
- **Session Tracking**: Multi-session support with child session adoption
- **Cleanup Coordination**: Graceful shutdown with pending request resolution

## Key Patterns & Conventions

### Testing Strategies
- **Mock Architecture**: Comprehensive dependency injection with EventEmitter-based sockets
- **Timer Control**: Deterministic async testing using `vi.useFakeTimers()` for retry/timeout scenarios  
- **Concurrency Testing**: Race condition validation for rapid connect/disconnect cycles
- **Error Injection**: Strategic failure simulation for resilience testing

### Protocol Patterns
- **Retry Logic**: Exponential backoff with maximum attempt limits (60 for connections, 6 for init)
- **Timeout Management**: Configurable timeouts (200ms connection intervals, 1000ms disconnect timeout)
- **Event Propagation**: Bidirectional event forwarding between proxy layers

### Error Handling
- **Graceful Degradation**: Continued operation during partial failures
- **Cleanup Coordination**: Proper resource disposal on errors/timeouts
- **Container Awareness**: Orphan detection adapted for containerized environments

## Integration Points
The proxy system integrates with:
- **VSCode Debug Protocol**: Standard DAP message format compliance
- **Python Debuggers**: Adapter-specific configuration and launch parameters
- **Child Session Management**: Multi-process debugging with session adoption patterns
- **Environment Validation**: Adapter capability checking and executable resolution

This testing suite ensures robust operation of the proxy layer under various failure modes, concurrent operations, and edge cases that occur in real debugging scenarios.