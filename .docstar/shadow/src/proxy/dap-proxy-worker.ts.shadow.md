# src\proxy\dap-proxy-worker.ts
@source-hash: b7037e10477ec44d
@generated: 2026-02-16T09:12:29Z

## Core Functionality

Main DAP (Debug Adapter Protocol) proxy worker that bridges debugging clients and debug adapters using the Adapter Policy pattern to eliminate language-specific hardcoding. Manages the complete lifecycle of debug sessions including adapter spawning, connection management, command queueing, and event handling.

## Key Classes & Components

### DapProxyWorker (L54-888)
Primary orchestration class managing debug session lifecycle with state machine transitions (UNINITIALIZED → INITIALIZING → CONNECTED/TERMINATED).

**Key Properties:**
- `adapterPolicy` (L70): Current adapter policy (DefaultAdapterPolicy, JsDebugAdapterPolicy, PythonAdapterPolicy, etc.)
- `adapterState` (L71): Policy-specific state tracking
- `commandQueue` (L72): Commands queued when adapter requires sequential processing  
- `preConnectQueue` (L73): Commands queued before DAP connection established
- `state` (L60): Current proxy state (ProxyState enum)
- `dapClient` (L56): Active DAP client connection
- `adapterProcess` (L57): Spawned debug adapter child process

**Core Methods:**
- `handleCommand()` (L135-171): Main command dispatcher for init/dap/terminate commands
- `handleInitCommand()` (L176-260): Initializes worker, spawns adapter, establishes connection
- `handleDapCommand()` (L568-676): Routes DAP commands with policy-based queueing logic
- `startAdapterAndConnect()` (L310-445): Spawns adapter process and establishes DAP connection
- `setupDapEventHandlers()` (L450-513): Configures event forwarding (initialized, output, stopped, etc.)
- `drainCommandQueue()` (L681-736): Processes queued commands sequentially
- `shutdown()` (L811-842): Clean termination of adapter process and connections

### DapProxyWorkerHooks (L40-52)
Configuration interface for testing/customization:
- `exit`: Custom process exit handler (defaults to process.exit)
- `createTraceFile`: DAP trace file factory for diagnostics

## Policy-Based Architecture

### Adapter Policy Selection (L102-123)
`selectAdapterPolicy()` chooses appropriate policy based on adapter command using matcher functions:
- JsDebugAdapterPolicy: Node.js/VS Code js-debug
- PythonAdapterPolicy: Python debugpy  
- RustAdapterPolicy: CodeLLDB for Rust
- GoAdapterPolicy: Delve debugger
- MockAdapterPolicy: Testing purposes
- DefaultAdapterPolicy: Fallback

### Policy-Driven Behavior
- **Command Queueing**: Some adapters require sequential command processing
- **Initialization Sequences**: Different launch vs attach vs deferred launch patterns
- **State Management**: Adapter-specific state tracking and updates
- **Spawn Configuration**: Adapter-specific process spawning parameters

## Connection Management Flow

### Standard Launch Mode (Python/debugpy):
1. Initialize DAP session
2. Send launch request
3. Wait for "initialized" event
4. Set breakpoints and send configurationDone

### Attach Mode:
1. Initialize DAP session  
2. Wait for "initialized" event
3. Send attach request
4. Set breakpoints and send configurationDone

### Deferred Launch Mode (Go/Delve):
1. Initialize DAP session
2. Wait for "initialized" event (sent immediately after initialize response)
3. Send launch request
4. Set breakpoints and send configurationDone

## Dependencies

- `@vscode/debugprotocol`: DAP protocol types
- `@debugmcp/shared`: Adapter policy implementations
- `CallbackRequestTracker` (L22): Request timeout management
- `GenericAdapterManager` (L23): Process spawning and lifecycle
- `DapConnectionManager` (L24): DAP client connection management
- `validateProxyInitPayload` (L26): Input validation

## Critical Features

### Command Queueing (L583-615)
Policy-driven queueing prevents race conditions with adapters that require sequential processing. Supports silent commands (e.g., auto-injected configurationDone).

### Request Tracking (L82-84, L787-790)
Timeout management for DAP requests prevents hanging operations.

### Dry Run Mode (L240-243, L266-305)  
Testing mode that logs intended adapter command without execution. Includes Windows IPC message flushing fixes.

### State Synchronization (L61-64, L467-476)
Complex event ordering with deferred "initialized" event handling to support different adapter initialization patterns.

### Error Handling & Recovery (L166-170, L247-259)
Comprehensive error handling with graceful shutdown and proper IPC message flushing before process exit.