# src/proxy/dap-proxy-worker.ts
@source-hash: f583e48b8fa21242
@generated: 2026-02-11T16:13:07Z

## Primary Purpose
Core worker class that handles DAP (Debug Adapter Protocol) proxy functionality using the Adapter Policy pattern to eliminate language-specific hardcoding. Manages the complete lifecycle of debug sessions including adapter spawning, connection management, and DAP message routing.

## Key Classes and Functions

### DapProxyWorker (L54-858)
Main worker class responsible for debug session orchestration. Key properties:
- **State Management**: Tracks proxy state through ProxyState enum (L60), manages initialization flow
- **Adapter Policy System**: Uses pluggable AdapterPolicy (L70) to handle language-specific behavior
- **Command Queueing**: Maintains commandQueue and preConnectQueue (L72-73) for proper DAP sequencing
- **Dependency Injection**: Accepts DapProxyDependencies for testability

### Constructor (L78-97)
Initializes worker with dependencies and hooks:
- Sets up CallbackRequestTracker for request timeout handling
- Configures exit hook (default: process.exit) and trace file factory
- Creates initial adapter state using DefaultAdapterPolicy

### Core Command Handlers

#### handleCommand (L135-171)
Main command dispatcher that routes init, dap, and terminate commands. Provides comprehensive error handling and logging.

#### handleInitCommand (L176-260)
Complex initialization sequence:
- Validates payload and selects appropriate AdapterPolicy based on adapter command (L196)
- Creates logger, process manager, and connection manager
- Handles dry-run mode for command verification (L240-242)
- Orchestrates adapter spawning and connection establishment

#### handleDapCommand (L538-646)
Routes DAP protocol messages with sophisticated queueing logic:
- Implements pre-connect queueing for commands received before adapter ready
- Uses AdapterPolicy.shouldQueueCommand for language-specific queuing decisions (L553)
- Handles silent commands for internal protocol management (L567-578)
- Tracks requests via CallbackRequestTracker for timeout handling

### Adapter Management

#### selectAdapterPolicy (L102-123)
Policy selection logic that matches adapter commands to specific language policies:
- Supports JsDebugAdapterPolicy, PythonAdapterPolicy, RustAdapterPolicy, GoAdapterPolicy, MockAdapterPolicy
- Falls back to DefaultAdapterPolicy for unknown adapters

#### startAdapterAndConnect (L310-415)
Spawns debug adapter process and establishes DAP connection:
- Gets spawn configuration from selected AdapterPolicy
- Handles both launch and attach modes with different DAP sequencing
- Manages "initialized" event timing based on adapter requirements

### Event and Queue Management

#### setupDapEventHandlers (L420-483)
Configures DAP event forwarding with policy-aware state updates:
- Routes initialized, output, stopped, continued, thread, exited, terminated events
- Updates adapter state via AdapterPolicy.updateStateOnEvent when available

#### drainCommandQueue (L651-706)
Processes queued DAP commands:
- Uses AdapterPolicy.processQueuedCommands for custom ordering if available
- Handles silent commands that don't require responses
- Manages request tracking and response sending

#### drainPreConnectQueue (L744-752)
Processes commands received before adapter connection was established.

### Specialized Behaviors

#### handleDryRun (L266-305)
Dry-run mode that shows what command would be executed without actually spawning adapter. Includes Windows IPC message flushing fixes.

#### ensureInitialStop (L711-739)
JavaScript-specific functionality that pauses execution after launch by finding first thread and sending pause command.

## Key Dependencies
- **CallbackRequestTracker**: Request timeout management (L22, L65)
- **GenericAdapterManager**: Process spawning and lifecycle (L23, L66)
- **DapConnectionManager**: DAP protocol connection handling (L24, L67)
- **AdapterPolicy implementations**: Language-specific behavior from @debugmcp/shared package (L31-38)

## Architecture Patterns
- **Adapter Policy Pattern**: Eliminates hardcoded language-specific logic through pluggable policies
- **State Machine**: Uses ProxyState enum for lifecycle management
- **Command Queue Pattern**: Handles DAP sequencing requirements per adapter type
- **Dependency Injection**: Accepts all external dependencies for testability

## Critical Invariants
- Commands must be queued appropriately based on adapter policy requirements
- "initialized" event timing varies by adapter (some need it before launch/attach, others after)
- State transitions must follow: UNINITIALIZED → INITIALIZING → CONNECTED → SHUTTING_DOWN → TERMINATED
- Request tracking ensures all DAP requests receive responses or timeout notifications

## Message Flow
Worker communicates with parent via structured messages (StatusMessage, DapResponseMessage, DapEventMessage, ErrorMessage) sent through dependencies.messageSender interface.