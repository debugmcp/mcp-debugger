# src/proxy/proxy-manager.ts
@source-hash: 27f6b0410b203d31
@generated: 2026-02-10T00:42:03Z

## Purpose

ProxyManager orchestrates spawning and communication with external debug proxy processes. It acts as a bridge between debug clients and language-specific debugger adapters, managing process lifecycle, DAP (Debug Adapter Protocol) message routing, and adapter launch barriers.

## Key Components

### Interfaces
- **ProxyManagerEvents** (L30-46): Event contract defining DAP lifecycle events (stopped, continued, terminated), proxy status events (initialized, error, exit), and custom events (dry-run-complete, adapter-configured)
- **IProxyManager** (L51-73): Main interface extending EventEmitter with typed event methods, DAP request handling, and dry-run state queries

### Message Types
- **ProxyStatusMessage** (L76-82): Union type for proxy lifecycle status updates with session tracking
- **ProxyDapEventMessage** (L84-90): DAP event forwarding from proxy to client
- **ProxyDapResponseMessage** (L92-101): DAP command response with success/failure indication
- **ProxyMessage** (L110): Discriminated union of all proxy message types

### Core Implementation
**ProxyManager** (L125-1047): Concrete EventEmitter implementation managing:
- **Process Management**: Spawning proxy via IProxyProcessLauncher, handling lifecycle events
- **DAP Communication**: Request/response correlation using UUID requestIds, timeout handling (35s default)
- **State Synchronization**: Dual state management with functional core (dapState) and imperative local state
- **Adapter Integration**: Optional IDebugAdapter for environment validation and executable resolution

## Critical Methods

**start()** (L166-298): 
- Validates configuration and spawns proxy process
- Sets up event handlers and sends initialization command with retry logic (5 attempts)
- Waits for 'initialized' or 'dry-run-complete' events with 30s timeout

**sendDapRequest()** (L345-429):
- Correlates requests using UUID with timeout handling
- Integrates AdapterLaunchBarrier for complex launch sequences
- Manages functional core state mirroring for observability

**handleProxyMessage()** (L731-823):
- Routes messages through functional core when available
- Fast-path DAP event forwarding to prevent missed breakpoints
- Executes side-effect commands from functional core (logging, events, process control)

## State Management

**Dual Architecture**:
- **Imperative State**: Direct ProxyManager fields for immediate access (currentThreadId, isInitialized)
- **Functional Core**: dapState managed via pure functions from dap-core module for consistency and testing

**Request Tracking**:
- pendingDapRequests Map for Promise resolution/rejection (L129-133)
- Mirrored in functional core via addPendingRequest/removePendingRequest

## Dependencies

**External**: @vscode/debugprotocol for DAP types, uuid for request correlation, EventEmitter for pub/sub
**Internal**: dap-core functional state management, shared interfaces (IFileSystem, ILogger, IProxyProcessLauncher), ProxyConfig for launch parameters

## Runtime Environment

**ProxyRuntimeEnvironment** (L112-120): Abstraction for module resolution and working directory, enabling testability through dependency injection with DEFAULT_RUNTIME_ENVIRONMENT fallback.

## Error Handling

- Comprehensive exit detail capture (L142-149) with stderr buffering during initialization
- Graceful shutdown with 5s timeout before SIGKILL (L300-343)  
- Request timeout management with cleanup on proxy exit
- Retry logic for initialization commands with exponential backoff

## Thread Management

Opportunistic thread ID capture from 'threads' DAP responses (L847-859) and 'stopped' events (L875-884) for maintaining current debugging context.