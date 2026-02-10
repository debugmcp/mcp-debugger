# src/proxy/proxy-manager.ts
@source-hash: 3ed8cde34cbdcccb
@generated: 2026-02-10T21:25:43Z

## ProxyManager - Debug Proxy Process Orchestrator

**Primary Purpose:** Manages spawning, communication, and lifecycle of debug proxy processes that bridge between the debug MCP server and actual debuggers. Handles DAP (Debug Adapter Protocol) message routing with timeout management and state synchronization.

### Core Architecture

- **ProxyManager Class (L125-1059)**: Main orchestrator extending EventEmitter for async proxy process management
- **IProxyManager Interface (L51-73)**: Contract defining proxy lifecycle and DAP request handling capabilities
- **ProxyManagerEvents Interface (L30-46)**: Typed event system for DAP events, lifecycle events, and status notifications

### Key Components

**State Management:**
- `dapState` (L141): Functional core state from `@debugmcp/shared` for DAP session tracking
- `pendingDapRequests` (L129-133): Map of outstanding DAP requests with Promise resolution callbacks
- `activeLaunchBarrier` (L152): Optional adapter-provided launch synchronization mechanism

**Process Lifecycle:**
- `start()` (L171-304): Spawns proxy process, validates environment, sends initialization commands with retry logic
- `stop()` (L306-350): Graceful shutdown with timeout fallback to SIGKILL
- `setupEventHandlers()` (L667-736): Registers IPC message, stderr, and exit event handlers

**Communication Layer:**
- `sendDapRequest()` (L352-436): Routes DAP commands to proxy with Promise-based response handling and timeouts
- `handleProxyMessage()` (L738-835): Processes incoming proxy messages, delegates to functional core, executes side effects
- `sendCommand()` (L610-665): Low-level IPC command sending with connection state debugging

### Message Protocol

**ProxyMessage Union Type (L110)**: Discriminated union of:
- `ProxyStatusMessage` (L76-82): Process lifecycle status updates
- `ProxyDapEventMessage` (L84-90): DAP events from debugger (stopped, continued, etc.)
- `ProxyDapResponseMessage` (L92-101): DAP request responses
- `ProxyErrorMessage` (L103-108): Error notifications

### Integration Points

**Dependencies:**
- `IProxyProcessLauncher` (L158): Abstracts proxy process spawning
- `IDebugAdapter` (L157): Optional language-specific adapter for environment validation
- `IFileSystem` & `ILogger` (L159-160): Infrastructure services
- DAP core functions from `../dap-core/index.js` (L14-22) for state management

**Runtime Environment:**
- `ProxyRuntimeEnvironment` (L112-115): Configurable module resolution for proxy script location
- `findProxyScript()` (L498-531): Locates `proxy-bootstrap.js` with fallback paths for dev/dist layouts

### Critical Features

**Retry Logic:**
- `sendInitWithRetry()` (L533-608): Exponential backoff for proxy initialization with detailed error reporting

**Dry Run Support:**
- Special handling for command preview mode without actual debugger spawning
- `hasDryRunCompleted()` & `getDryRunSnapshot()` (L1046-1058): Query dry run results

**Error Handling:**
- Comprehensive stderr capture during initialization (L704-707)
- Exit detail tracking with stderr context for diagnostics (L143-150)
- Graceful handling of late IPC messages during shutdown (L740-743)

**Thread Management:**
- Opportunistic thread ID capture from DAP responses (L860-871)
- Current thread tracking for multi-threaded debugging sessions

### Invariants

- Only one proxy process active per manager instance
- DAP requests must have proxy initialized (`isInitialized = true`)
- Pending requests cleaned up on proxy exit to prevent memory leaks
- Launch barriers disposed properly to avoid resource leaks