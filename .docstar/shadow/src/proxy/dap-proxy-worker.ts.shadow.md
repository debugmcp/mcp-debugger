# src\proxy\dap-proxy-worker.ts
@source-hash: 80f8761b2a004a3f
@generated: 2026-02-24T01:54:34Z

## Purpose

Core orchestration class for the DAP (Debug Adapter Protocol) Proxy system. Implements the Adapter Policy pattern to support multiple programming language debuggers through pluggable adapters, managing the full debugging session lifecycle from initialization to termination.

## Architecture

The worker follows a state machine pattern (ProxyState enum) with these key transitions:
- `UNINITIALIZED` → `INITIALIZING` → `CONNECTED` → `SHUTTING_DOWN` → `TERMINATED`
- Command queueing is used for adapters that require specific DAP message ordering

## Core Classes and Components

### DapProxyWorker (L54-914)
Main orchestrator class managing debugging sessions with these responsibilities:
- Session state management and DAP protocol handling
- Adapter process lifecycle (spawn, monitor, terminate)
- Command queuing and request tracking for complex initialization sequences
- Policy-based adapter selection and configuration

**Key Dependencies:**
- `CallbackRequestTracker` (L65) - tracks DAP request timeouts
- `GenericAdapterManager` (L66) - handles adapter process spawning
- `DapConnectionManager` (L67) - manages DAP client connections
- `AdapterPolicy` instances (L70) - language-specific behavior policies

### DapProxyWorkerHooks (L40-52)
Configuration interface for dependency injection:
- `exit` - custom process termination handler
- `createTraceFile` - DAP frame tracing configuration

## Key Methods

### Command Handling
- `handleCommand(command)` (L135) - main entry point for parent process commands
- `handleInitCommand(payload)` (L176) - initialization sequence orchestration
- `handleDapCommand(payload)` (L594) - DAP request routing and queueing
- `handleTerminate()` (L821) - graceful shutdown initiation

### Adapter Management
- `selectAdapterPolicy(adapterCommand)` (L102) - policy selection based on adapter command
- `startAdapterAndConnect(payload)` (L320) - adapter spawning and DAP connection setup
- `setupDapEventHandlers()` (L476) - DAP event routing to parent process

### Command Queueing
- `drainCommandQueue()` (L707) - processes queued commands through policy
- `drainPreConnectQueue()` (L800) - handles commands received during initialization

## Adapter Policy Integration

The worker uses the Adapter Policy pattern to eliminate language-specific hardcoding:

**Policy Selection (L108-122):**
- JavaScript: `JsDebugAdapterPolicy.matchesAdapter()`
- Python: `PythonAdapterPolicy.matchesAdapter()` 
- Rust: `RustAdapterPolicy.matchesAdapter()`
- Go: `GoAdapterPolicy.matchesAdapter()`
- Mock: `MockAdapterPolicy.matchesAdapter()`
- Fallback: `DefaultAdapterPolicy`

**Policy Usage:**
- Spawn configuration via `getAdapterSpawnConfig()`
- Command queueing decisions via `shouldQueueCommand()`
- State management via `updateStateOnCommand/Event/Response()`
- Initialization behavior via `getInitializationBehavior()`

## Initialization Patterns

### Standard Launch Mode (L450-463)
1. Send `initialize` request
2. Send `launch` request
3. Wait for `initialized` event
4. Set breakpoints and send `configurationDone`

### Attach Mode (L392-410)
1. Send `initialize` request
2. Wait for `initialized` event
3. Send `attach` request
4. Complete configuration

### Two-Phase Initialization (L411-449)
For adapters like Go/Delve that may send `initialized` before or after `launch`:
1. Brief wait for `initialized` event
2. Send `launch` request
3. Wait for `initialized` if not received
4. Complete configuration

## Error Handling and Recovery

- Request timeout tracking via `CallbackRequestTracker`
- Graceful shutdown with process cleanup
- Dry run mode for testing adapter configuration
- IPC message flushing for reliable Windows operation

## State Management

- `ProxyState` enum tracks worker lifecycle
- `AdapterSpecificState` managed per-policy
- Command queuing for adapters requiring ordered message sequences
- Request/response correlation with timeout handling

## Communication Protocol

**Outbound Messages:**
- `StatusMessage` - worker state updates
- `DapResponseMessage` - DAP request responses  
- `DapEventMessage` - DAP events from adapter
- `ErrorMessage` - error notifications

**Message Routing (L872-913):**
- All messages sent via `dependencies.messageSender.send()`
- Session ID correlation for multi-session support