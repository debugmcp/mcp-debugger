# src/proxy/proxy-manager.ts
@source-hash: 27f6b0410b203d31
@generated: 2026-02-09T18:15:15Z

## ProxyManager - Debug Adapter Protocol Proxy Process Controller

Core orchestrator for spawning and managing debug proxy child processes that bridge between DAP clients and debug adapters.

### Primary Components

**ProxyManager Class (L125-1047)**: Main implementation extending EventEmitter
- Manages proxy process lifecycle (spawn, init, cleanup)
- Routes DAP requests/responses between client and proxy
- Handles adapter-specific launch barriers and dry-run operations
- Maintains pending request tracking and thread state

**Key Interfaces**:
- `IProxyManager (L51-73)`: Contract defining proxy management operations
- `ProxyManagerEvents (L30-46)`: Typed event definitions for DAP lifecycle, proxy status, and errors

### Critical State Management

**Process State (L126-154)**:
- `proxyProcess`: Active child process handle  
- `sessionId`: Unique session identifier
- `currentThreadId`: Active debugging thread
- `pendingDapRequests`: Map of outstanding DAP requests with Promise resolvers
- `dapState`: Functional core state mirror for observability

**Lifecycle Flags**:
- `isInitialized`: Proxy ready for DAP communication
- `isDryRun`: Operating in command validation mode only
- `dryRunCompleteReceived`: Dry run execution completed
- `adapterConfigured`: Debug adapter successfully launched

### Key Operations

**start() (L166-298)**: 
- Validates environment and resolves executable paths
- Spawns proxy process via `IProxyProcessLauncher`
- Sends initialization command with retry backoff (L526-601)
- Waits for initialization or dry-run completion with 30s timeout

**sendDapRequest() (L345-429)**:
- Routes DAP commands to proxy with unique request IDs
- Handles adapter launch barriers for complex startup sequences
- Maintains request/response correlation via `pendingDapRequests` map
- 35s timeout per request

**Message Processing (L731-823)**:
- Validates incoming proxy messages via `isValidProxyMessage`
- Fast-path forwards DAP events to prevent missing breakpoints/output
- Delegates to functional core (`handleProxyMessage`) for state transitions
- Executes commands returned by functional core (logging, events, process control)

### Message Protocol Types (L76-110)

**ProxyStatusMessage**: Lifecycle events (init_received, dry_run_complete, adapter_configured, etc.)
**ProxyDapEventMessage**: Debug events (stopped, continued, terminated, etc.) 
**ProxyDapResponseMessage**: DAP command responses with success/error status
**ProxyErrorMessage**: Error conditions from proxy process

### Dependencies

**External**: 
- `@vscode/debugprotocol` for DAP types
- `@debugmcp/shared` for abstractions (IDebugAdapter, IProxyProcessLauncher, etc.)

**Internal**:
- `../dap-core/index.js` for functional state management
- `./proxy-config.js` for configuration types
- `../utils/error-messages.js` for standardized error text

### Architecture Patterns

**Hybrid Imperative/Functional**: Maintains imperative shell for event handling while delegating state transitions to pure functional core

**Event-Driven**: Extensive use of EventEmitter for loose coupling between proxy lifecycle, DAP events, and client consumers

**Error Resilience**: Comprehensive error handling with retry logic, timeouts, graceful degradation, and stderr capture for diagnostics

**Resource Management**: Careful cleanup of pending requests, barriers, and process handles during shutdown

### Critical Invariants

- Only one proxy process per manager instance
- All DAP requests must have unique UUIDs for correlation
- Thread IDs are opportunistically captured from DAP responses
- Dry run mode exits after command validation without persistent debugging
- Launch barriers coordinate complex adapter startup sequences