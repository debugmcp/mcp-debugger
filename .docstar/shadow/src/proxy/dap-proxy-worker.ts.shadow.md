# src\proxy\dap-proxy-worker.ts
@source-hash: 5c75a74b5d182cf6
@generated: 2026-02-16T08:24:12Z

**Purpose**: Core worker class implementing a language-agnostic DAP (Debug Adapter Protocol) proxy using the Adapter Policy pattern to eliminate hardcoded language-specific logic.

**Architecture**: Uses composition-based dependency injection with manager classes for process spawning (GenericAdapterManager), DAP connections (DapConnectionManager), and request tracking (CallbackRequestTracker). Supports multiple debug adapter types through interchangeable adapter policies.

## Key Classes & Components

### DapProxyWorker (L54-888)
Main orchestrator class managing debug adapter lifecycle and DAP protocol communication.

**Core State Management**:
- `state: ProxyState` (L60) - tracks initialization/connection status
- `adapterPolicy: AdapterPolicy` (L70) - configurable language-specific behavior
- `adapterState: AdapterSpecificState` (L71) - policy-managed adapter state
- `commandQueue` (L72) and `preConnectQueue` (L73) - command buffering

**Key Dependencies**:
- `processManager: GenericAdapterManager` (L66) - adapter process lifecycle
- `connectionManager: DapConnectionManager` (L67) - DAP client connections
- `requestTracker: CallbackRequestTracker` (L65) - timeout handling for DAP requests

### DapProxyWorkerHooks (L40-52)
Configuration interface for customizing worker behavior:
- `exit?: (code: number) => void` - custom termination handler
- `createTraceFile?: (sessionId: string, logDir: string) => string` - DAP tracing setup

## Core Operations

### Initialization Flow (L176-260)
1. Validates payload and selects adapter policy via `selectAdapterPolicy()` (L102-123)
2. Sets up logging and tracing infrastructure
3. Handles dry-run mode (L240-243) or proceeds to adapter startup
4. Policy-driven adapter spawning and DAP connection establishment

### Policy Selection (L102-123)
Matches adapter commands to policies using `matchesAdapter()` method:
- JsDebugAdapterPolicy, PythonAdapterPolicy, RustAdapterPolicy, GoAdapterPolicy, MockAdapterPolicy
- Falls back to DefaultAdapterPolicy for unknown adapters

### Command Handling (L135-171)
Routes parent commands (`init`, `dap`, `terminate`) with comprehensive error handling and logging.

### DAP Protocol Management (L568-676)
- Command queueing based on `adapterPolicy.shouldQueueCommand()` (L583)
- State tracking via policy callbacks (`updateStateOnCommand`, `updateStateOnResponse`)
- Request/response correlation with timeout handling

### Initialization Sequencing (L310-445)
Handles complex DAP initialization patterns:
- **Attach Mode**: Wait for `initialized` event before `attach` request (L382-400)
- **Deferred Launch Mode**: Wait for `initialized` before `launch` (Go/Delve) (L401-423)
- **Standard Launch Mode**: Send `launch` first, then wait for `initialized` (L424-437)

### Event Processing (L450-513)
Sets up comprehensive DAP event handlers with policy-driven state updates:
- `onInitialized` - triggers command queue drainage or deferred handling
- Output, thread, breakpoint events - forwarded to parent
- Termination events - trigger cleanup sequence

### Command Queue Management (L681-736)
- Policy-based command ordering via `processQueuedCommands()`
- Silent command injection (e.g., `configurationDone`)
- Error isolation per queued command

### Process Lifecycle (L811-842)
Coordinated shutdown sequence:
1. Clear request tracking and reject in-flight requests
2. Disconnect DAP client via connection manager
3. Terminate adapter process via process manager
4. Update state to TERMINATED

## Dependencies & Relationships

**External Dependencies**:
- `@vscode/debugprotocol` - DAP types and protocol definitions
- `@debugmcp/shared` - adapter policy implementations
- Child process management for adapter spawning

**Internal Dependencies**:
- `./dap-proxy-interfaces.js` - core type definitions
- `./dap-proxy-request-tracker.js` - request timeout management
- `./dap-proxy-adapter-manager.js` - process spawning abstraction
- `./dap-proxy-connection-manager.js` - DAP client lifecycle
- `../utils/type-guards.js` - payload validation

## Critical Patterns

**Adapter Policy Pattern**: Eliminates language-specific hardcoding by delegating adapter behavior to pluggable policy objects that define initialization sequences, command queueing rules, and state management.

**Command Queueing**: Supports adapters requiring sequential command processing with policy-driven queue management and silent command injection.

**State Machine**: Tracks proxy state (UNINITIALIZED → INITIALIZING → CONNECTED → SHUTTING_DOWN → TERMINATED) with guarded state transitions.

**Timeout Management**: Tracks DAP requests with configurable timeouts to prevent hanging on unresponsive adapters.

**IPC Message Flushing**: Uses `setImmediate` and `setTimeout` for reliable IPC message delivery before process termination, especially on Windows (L254-258, L295-304).