# src\proxy\proxy-manager.ts
@source-hash: 28506805173f4ca4
@generated: 2026-02-24T01:54:20Z

**Purpose**: Manages lifecycle of debug adapter proxy processes, handling spawn/communication/cleanup and bridging DAP messages between clients and debug adapters.

## Core Components

### ProxyManager Class (L126-1065)
Main orchestrator class that extends EventEmitter and implements IProxyManager interface. Manages proxy process lifecycle, message handling, and DAP request/response flow.

**Key State**:
- `proxyProcess` (L127): IProxyProcess instance for child process communication
- `sessionId` (L128): Unique session identifier
- `pendingDapRequests` (L130): Map tracking outstanding DAP requests with promises
- `dapState` (L142): Functional core state mirror for observability
- `activeLaunchBarrier` (L153): Adapter-provided launch synchronization

**Core Methods**:
- `start(config)` (L172-305): Spawns proxy process, sends init command, waits for initialization
- `stop()` (L307-352): Graceful shutdown with terminate command and force kill fallback
- `sendDapRequest<T>()` (L354-438): Sends DAP commands to proxy with promise-based response handling
- `sendInitWithRetry()` (L535-610): Robust initialization with exponential backoff retry logic

### Event Handling System

**ProxyManagerEvents Interface** (L31-47): Defines typed event signatures for DAP events (stopped, continued, terminated), proxy lifecycle (initialized, error, exit), and status events (dry-run-complete, adapter-configured).

**Message Processing** (L742-839):
- `handleProxyMessage()`: Central message dispatcher that validates, routes to functional core, and executes side effects
- Fast-path forwarding for DAP events to avoid missing critical stops/output
- Integration with functional `dap-core` for state management and command generation

### Proxy Communication

**Message Types** (L77-111): Union types defining proxy IPC protocol:
- `ProxyStatusMessage`: Process lifecycle and initialization status
- `ProxyDapEventMessage`: Debug adapter events forwarded from proxy
- `ProxyDapResponseMessage`: Responses to DAP requests with success/error handling
- `ProxyErrorMessage`: Error reporting from proxy process

**Command Sending** (L612-667): Robust IPC with detailed logging, connection state tracking, and error handling for child process communication failures.

### Initialization & Environment Setup

**Environment Preparation** (L452-533):
- `prepareSpawnContext()`: Resolves executable paths via adapter or config
- `findProxyScript()`: Locates proxy bootstrap script across build layouts
- Environment validation and cloning

**Adapter Integration**: Optional language-specific adapter support for executable resolution, environment validation, and launch barriers for synchronization.

### Error Handling & Observability

**Comprehensive Logging**: Detailed debug/info/error logging throughout lifecycle with message sanitization for sensitive data.

**Exit Tracking** (L144-151): Captures exit details including code, signal, timestamp, and stderr for detailed error reporting.

**Retry Logic**: Exponential backoff for init commands, timeout handling for DAP requests, graceful degradation on communication failures.

## Architecture Notes

- **Functional/Imperative Hybrid**: Uses functional `dap-core` for state management while maintaining imperative shell for I/O and side effects
- **Event-Driven**: Heavy use of EventEmitter pattern for loose coupling between components
- **Defensive Programming**: Extensive null checks, error boundaries, and cleanup to handle process lifecycle edge cases
- **Language Agnostic**: Optional adapter pattern allows supporting multiple debug adapter types