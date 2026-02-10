# src/proxy/dap-proxy-worker.ts
@source-hash: c35edafb986069fb
@generated: 2026-02-10T01:19:16Z

## Primary Purpose and Responsibility

Core worker class that orchestrates Debug Adapter Protocol (DAP) debugging sessions. Acts as a proxy between parent processes and language-specific debug adapters, implementing the Adapter Policy pattern to eliminate hardcoded language-specific logic. Manages the full debugging lifecycle including adapter spawning, DAP connection establishment, command routing, and session cleanup.

## Key Classes and Functions

**DapProxyWorker (L55-861)** - Main orchestrator class
- `constructor(dependencies, hooks)` (L79-98) - Initializes with dependency injection and configurable hooks
- `handleCommand(command)` (L138-174) - Main command dispatcher for init/dap/terminate commands
- `handleInitCommand(payload)` (L179-263) - Processes initialization with adapter policy selection and spawning
- `selectAdapterPolicy(adapterCommand)` (L103-126) - Chooses appropriate adapter policy based on command matching
- `startAdapterAndConnect(payload)` (L313-418) - Spawns adapter process and establishes DAP connection
- `handleDapCommand(payload)` (L541-649) - Routes DAP commands with policy-based queueing decisions
- `shutdown()` (L784-815) - Clean teardown of all resources

**DapProxyWorkerHooks (L41-53)** - Configuration interface for testing/customization
- `exit` - Custom exit handler (defaults to process.exit)
- `createTraceFile` - DAP frame tracing configuration factory

## Important Dependencies and Relationships

**External Dependencies:**
- `@debugmcp/shared` - Provides adapter policies (DefaultAdapterPolicy, JsDebugAdapterPolicy, etc.) (L30-39)
- `@vscode/debugprotocol` - DAP protocol definitions (L8)
- Child process management and DAP client interfaces (L9-21)

**Internal Dependencies:**
- `CallbackRequestTracker` (L22) - Tracks DAP request timeouts
- `GenericAdapterManager` (L23) - Handles adapter process lifecycle  
- `DapConnectionManager` (L24) - Manages DAP socket connections
- `validateProxyInitPayload` (L26) - Input validation utilities

**State Management:**
- `ProxyState` enum tracking: UNINITIALIZED → INITIALIZING → CONNECTED → SHUTTING_DOWN → TERMINATED
- Policy-specific adapter state via `AdapterSpecificState` (L72)

## Notable Patterns and Architectural Decisions

**Adapter Policy Pattern** - Language-specific behavior encapsulated in policy objects:
- Policy selection based on adapter command matching (L103-126)
- Policies control command queueing, initialization sequences, and state updates
- Supports JS/Node, Python, Java, Rust, Go, and Mock adapters

**Command Queueing Strategy** - Two-tier queuing system:
- Pre-connect queue for commands received during initialization (L74, L545-548)
- Policy-driven command queue for adapters requiring specific ordering (L73, L556-588)
- Silent command injection for deferred configuration (L570-580)

**Event-Driven Architecture** - Asynchronous event handling:
- DAP event forwarding with policy state updates (L423-486)
- Deferred "initialized" event handling for attach mode (L376-396)
- Request timeout tracking with cleanup (L759-763)

**Error Recovery** - Graceful degradation and cleanup:
- Idempotent command handling for retries (L180-185)
- Windows IPC message flushing for dry runs (L296-307)
- Resource cleanup on shutdown with proper ordering (L784-815)

## Critical Invariants and Constraints

**State Transitions** - Strict state machine enforcement:
- Init only allowed from UNINITIALIZED state (L188-190)
- Commands queued if received before DAP connection ready
- Shutdown prevents further state transitions (L770, L785-787)

**DAP Protocol Compliance** - Sequence requirements vary by adapter:
- Launch mode: launch request → wait for "initialized" → configuration
- Attach mode: wait for "initialized" → attach request → configuration  
- Command queueing policies ensure proper DAP message ordering

**Resource Management** - Proper lifecycle handling:
- Adapter processes must be spawned before DAP connection
- DAP client shutdown clears pending requests and timers
- Process termination follows DAP disconnect for clean teardown

**Policy Contracts** - Adapter policies must provide:
- `matchesAdapter()` for command-based selection
- `getAdapterSpawnConfig()` for process creation
- Optional queueing and state management hooks