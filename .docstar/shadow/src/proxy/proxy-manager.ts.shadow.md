# src\proxy\proxy-manager.ts
@source-hash: b5325b85040ceaac
@generated: 2026-02-19T23:47:54Z

## Primary Purpose
ProxyManager orchestrates the lifecycle of debug proxy processes for a Debug Adapter Protocol (DAP) system. It spawns and communicates with child proxy processes that manage debugger adapters, providing a bridge between debug clients and language-specific debug adapters.

## Key Classes and Interfaces

### ProxyManagerEvents Interface (L30-46)
Defines typed events emitted by ProxyManager:
- DAP lifecycle: 'stopped', 'continued', 'terminated', 'exited'
- Proxy lifecycle: 'initialized', 'error', 'exit'
- Status events: 'dry-run-complete', 'adapter-configured', 'dap-event'

### IProxyManager Interface (L51-73)
Core interface defining proxy manager contract:
- `start(config: ProxyConfig)`: Initializes and spawns proxy process
- `stop()`: Gracefully terminates proxy
- `sendDapRequest<T>()`: Sends DAP commands to adapter via proxy
- Thread management and status methods
- Typed EventEmitter methods

### ProxyManager Class (L125-1062)
Main implementation managing proxy process lifecycle:

**Key State:**
- `proxyProcess: IProxyProcess | null` (L126): Child process handle
- `sessionId: string | null` (L127): Debug session identifier
- `pendingDapRequests` (L129-133): Map tracking DAP request/response correlation
- `dapState: DAPSessionState` (L141): Functional core state for DAP operations
- `activeLaunchBarrier: AdapterLaunchBarrier` (L152): Adapter synchronization

**Critical Methods:**
- `start(config)` (L171-304): Spawns proxy, sends init command, waits for ready
- `stop()` (L306-351): Graceful shutdown with timeout fallback
- `sendDapRequest<T>()` (L353-437): Async DAP command dispatch with barriers
- `handleProxyMessage()` (L739-836): Core message routing from proxy process

## Message Types and Protocol

### Proxy Message Types (L76-110)
- `ProxyStatusMessage`: Status updates (init, dry-run, adapter events)
- `ProxyDapEventMessage`: DAP events forwarded from adapter
- `ProxyDapResponseMessage`: DAP command responses with success/error
- `ProxyErrorMessage`: Error notifications from proxy

### Message Handling Strategy
- Fast-path DAP events (L774-776): Immediate forwarding to prevent missed stops
- Functional core integration (L784-836): Uses pure functions from dap-core for state transitions
- Imperative request tracking (L838-877): Maps request IDs to Promise resolvers

## Dependencies and Architecture

**Core Dependencies:**
- `@debugmcp/shared`: Interfaces for adapters, file system, logging
- `../dap-core/index.js`: Functional DAP state management
- `../utils/error-messages.js`: Centralized error messages
- `./proxy-config.js`: Configuration types

**Key Patterns:**
- **Hybrid Architecture**: Combines functional core (dap-core) with imperative shell
- **Event-Driven**: Extensive use of EventEmitter for lifecycle communication
- **Process Management**: Sophisticated child process lifecycle with retry logic
- **Request/Response Correlation**: UUID-based tracking of async DAP operations

## Critical Implementation Details

### Initialization Flow (L171-304)
1. Validates configuration and spawns proxy process
2. Sends init command with exponential backoff retry (L534-609)
3. Waits for 'initialized' or 'dry-run-complete' events
4. Handles early exit scenarios with stderr capture

### Adapter Launch Barriers (L361-391, L1025-1047)
Language-specific adapters can provide synchronization barriers for launch commands:
- Fire-and-forget mode: Commands that don't need response
- Barrier coordination: Wait for adapter readiness signals

### Error Handling and Robustness
- Stderr buffering during initialization (L142, L705-708)
- Exit detail capture with timestamps (L143-150, L714-719)
- Graceful shutdown with force-kill timeout (L331-350)
- Late message filtering after stop() (L741-744)

### Dry Run Mode
Special mode for command validation without execution:
- Captures command snapshots for reporting (L138-139, L932-941)
- Synthetic completion events on early exit (L975-985)

## State Management

The ProxyManager maintains both imperative state (request tracking, process handles) and mirrors functional state from dap-core for observability. State transitions are driven by proxy messages with command execution handled imperatively (L788-811).

## Notable Constraints

- Single proxy process per manager instance
- 35-second timeout for DAP requests
- 30-second initialization timeout
- Process cleanup prevents "unknown request" warnings during shutdown