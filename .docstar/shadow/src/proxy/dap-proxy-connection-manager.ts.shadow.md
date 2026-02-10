# src/proxy/dap-proxy-connection-manager.ts
@source-hash: 0da95555b2f9a012
@generated: 2026-02-09T18:15:10Z

## DAP Connection Manager

Core utility class for managing Debug Adapter Protocol (DAP) connections with robust retry logic and comprehensive session management.

### Primary Responsibility
Orchestrates DAP adapter connections, session initialization, event handling, and graceful disconnection with built-in resilience patterns for debugging environments.

### Key Classes & Functions

**DapConnectionManager (L14-323)**
- Main connection management class with configurable retry policies
- Dependencies: `IDapClientFactory`, `ILogger` for abstracted client creation and logging
- Optional `AdapterPolicy` support for client configuration customization

**Connection Management:**
- `connectWithRetry()` (L37-80): Implements exponential backoff connection strategy with 60 attempts, 200ms intervals, and 500ms initial delay
- `setAdapterPolicy()` (L30-32): Configures adapter-specific client creation policies
- `disconnect()` (L184-215): Graceful disconnection with timeout protection and cleanup guarantees

**Session Lifecycle:**
- `initializeSession()` (L85-123): Handles DAP initialize handshake with comprehensive capability negotiation
- `setupEventHandlers()` (L128-179): Event subscription manager for DAP protocol events (initialized, output, stopped, continued, thread, exited, terminated, error, close)
- `sendConfigurationDone()` (L318-322): Completion signal for initialization phase

**Launch/Attach Operations:**
- `sendLaunchRequest()` (L220-273): Configures and sends launch requests with script path resolution, argument handling, and debugging flags
- `sendAttachRequest()` (L278-285): Handles attach-to-process scenarios with custom configuration

**Debugging Tools:**
- `setBreakpoints()` (L290-313): Manages source breakpoints with conditional support

### Configuration Constants
- `INITIAL_CONNECT_DELAY`: 500ms (L17) - CI/test environment accommodation
- `MAX_CONNECT_ATTEMPTS`: 60 attempts (L18) 
- `CONNECT_RETRY_INTERVAL`: 200ms (L19)

### Dependencies
- `@vscode/debugprotocol`: DAP type definitions
- `./dap-proxy-interfaces.js`: Client factory and interface abstractions
- `@debugmcp/shared`: Adapter policy configuration

### Architectural Patterns
- Factory pattern for client creation with policy injection
- Retry pattern with exponential backoff for connection resilience
- Event-driven architecture for DAP protocol handling
- Graceful degradation with timeout protection on disconnect operations

### Critical Invariants
- Connection attempts always include temporary error handlers to prevent crashes during retry loops (L47-50)
- Disconnect operations always call `client.disconnect()` regardless of DAP protocol success (L207-214)
- Launch requests validate and resolve script paths with fallback logic (L235-242)