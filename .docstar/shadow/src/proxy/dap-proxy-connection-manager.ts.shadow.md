# src/proxy/dap-proxy-connection-manager.ts
@source-hash: 38bed81eddfc1753
@generated: 2026-02-10T21:25:33Z

## Primary Purpose

Manages Debug Adapter Protocol (DAP) connections with robust retry logic, session initialization, and comprehensive error handling. Central orchestrator for DAP client lifecycle management in the MCP Debug Proxy system.

## Key Classes and Methods

**DapConnectionManager (L14-294)**
- Main class managing DAP client connections and session lifecycle
- Configurable retry constants: INITIAL_CONNECT_DELAY (500ms), MAX_CONNECT_ATTEMPTS (60), CONNECT_RETRY_INTERVAL (200ms)
- Optional AdapterPolicy support for client creation customization

**Core Connection Methods:**
- `setAdapterPolicy()` (L30-32): Configures adapter policy for DAP client creation
- `connectWithRetry()` (L37-80): Primary connection method with exponential backoff, temporary error handling during connection phase
- `initializeSession()` (L85-101): Sends DAP initialize request with standardized client configuration
- `disconnect()` (L162-193): Graceful disconnection with timeout protection and cleanup

**Event Management:**
- `setupEventHandlers()` (L106-157): Registers comprehensive DAP event listeners (initialized, output, stopped, continued, thread, exited, terminated, error, close)

**Debug Session Control:**
- `sendLaunchRequest()` (L198-244): Configures and sends launch request with parameter resolution and defaults
- `sendAttachRequest()` (L249-256): Handles attach-to-process scenarios
- `setBreakpoints()` (L261-284): Manages source breakpoints with condition support
- `sendConfigurationDone()` (L289-293): Finalizes debug session setup

## Dependencies

- `@vscode/debugprotocol`: Core DAP types and interfaces
- `./dap-proxy-interfaces.js`: IDapClient, IDapClientFactory, ILogger, ExtendedInitializeArgs
- `@debugmcp/shared`: AdapterPolicy type

## Architectural Patterns

**Factory Pattern**: Uses IDapClientFactory for client instantiation with optional policy injection
**Observer Pattern**: Comprehensive event handler registration system
**Retry Pattern**: Exponential backoff with configurable attempts and intervals
**Graceful Degradation**: Timeout protection on disconnect operations (1000ms timeout on L175)

## Critical Invariants

- Connection retries respect MAX_CONNECT_ATTEMPTS limit (60 attempts)
- Temporary error handlers are always removed after connection success/failure
- Launch requests always include noDebug=false and console='internalConsole' defaults if not specified
- Disconnect operations attempt graceful DAP disconnect before forcing client cleanup