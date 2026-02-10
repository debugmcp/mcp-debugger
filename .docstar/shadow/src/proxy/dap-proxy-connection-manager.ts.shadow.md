# src/proxy/dap-proxy-connection-manager.ts
@source-hash: 4ec7d3774abf368d
@generated: 2026-02-10T01:19:01Z

**Purpose:** DAP (Debug Adapter Protocol) connection lifecycle management utility that handles connection establishment, initialization, and graceful cleanup for debug adapters with robust retry logic.

**Core Class:**
- `DapConnectionManager` (L14-294): Main orchestrator for DAP client connections

**Key Configuration Constants:**
- `INITIAL_CONNECT_DELAY` (L17): 500ms startup delay for debugpy initialization
- `MAX_CONNECT_ATTEMPTS` (L18): 60 retry attempts maximum
- `CONNECT_RETRY_INTERVAL` (L19): 200ms between retry attempts

**Primary Methods:**

**Connection Management:**
- `setAdapterPolicy()` (L30-32): Configures adapter policy for client creation
- `connectWithRetry()` (L37-80): Core connection method with exponential backoff, temporary error handling, and comprehensive retry logic
- `disconnect()` (L162-193): Graceful disconnection with timeout protection and dual cleanup (DAP disconnect + client cleanup)

**Session Lifecycle:**
- `initializeSession()` (L85-101): Sends DAP initialize request with standardized client configuration
- `setupEventHandlers()` (L106-157): Registers event listeners for all DAP protocol events (initialized, output, stopped, continued, thread, exited, terminated, error, close)
- `sendConfigurationDone()` (L289-293): Finalizes session setup

**Debugging Operations:**
- `sendLaunchRequest()` (L198-244): Launches debuggee with configuration merging and default fallbacks
- `sendAttachRequest()` (L249-256): Attaches to existing process
- `setBreakpoints()` (L261-284): Configures source breakpoints with optional conditions

**Dependencies:**
- `@vscode/debugprotocol`: DAP type definitions
- Local interfaces: `IDapClient`, `IDapClientFactory`, `ILogger`, `ExtendedInitializeArgs`
- `@debugmcp/shared`: `AdapterPolicy` type

**Architectural Patterns:**
- Factory pattern for DAP client creation with optional policy injection
- Event-driven architecture with comprehensive handler registration
- Robust error handling with temporary error suppression during connection phase
- Configuration merging with sensible defaults (noDebug: false, console: 'internalConsole')
- Promise racing for timeout protection on disconnect operations

**Key Invariants:**
- Always removes temporary error handlers after successful connection
- Performs dual cleanup on disconnect (protocol disconnect + client cleanup)
- Maintains session state through policy injection
- All operations include comprehensive logging for debugging