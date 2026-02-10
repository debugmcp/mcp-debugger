# src/proxy/minimal-dap.ts
@source-hash: e8ee3537abe0deea
@generated: 2026-02-09T18:15:24Z

## Primary Purpose
Implements a simplified DAP (Debug Adapter Protocol) client that manages communication with debug adapters, supporting both single-adapter debugging and complex multi-session scenarios with child process debugging. Built specifically for vscode-compatible message parsing with policy-driven behavior configuration.

## Core Architecture

### Main Class: MinimalDapClient (L35-782)
Event-driven DAP client extending EventEmitter, managing TCP socket communication to debug adapters using proper buffer management and message parsing compatible with vscode's ProtocolServer implementation.

**Key State Management:**
- Socket connection (`socket`, L36)
- Buffer management (`rawData`, `contentLength`, L37-38) 
- Request tracking (`pendingRequests`, `nextSeq`, L39-44)
- Child session orchestration (`childSessions`, `activeChild`, L50-51)
- Policy-driven behavior (`policy`, `dapBehavior`, L56-57)

### Message Processing Pipeline

**Buffer Management (L141-199)**
- `handleData()`: Implements vscode-compatible message boundary detection
- Parses Content-Length headers and extracts complete JSON messages
- Handles partial messages and malformed headers gracefully

**Protocol Message Dispatch (L201-338)**
- `handleProtocolMessage()`: Routes responses, events, and reverse requests
- Integrates policy-based reverse request handling for adapter-initiated commands
- Manages child session creation through `ChildSessionManager`

### Multi-Session Support

**Child Session Management (L99-135)**
- Integration with `ChildSessionManager` for policies supporting `supportsReverseStartDebugging`
- Event forwarding from child sessions (`childCreated`, `childEvent`, `childError`, `childClosed`)
- Active child tracking for request routing

**Request Routing Logic (L489-603)**
- Policy-driven routing decisions via `shouldRouteToChild()`
- Special handling for `stackTrace` commands with child session waiting
- Graceful fallback to parent session when child unavailable

### Policy Integration

**Adapter Policies (L82-87, L273-318)**
- `AdapterPolicy` configuration for adapter-specific behaviors
- `DapClientBehavior` defines routing, normalization, and session management
- Policy-driven reverse request handling with context passing

**Configuration Deferral (L457-487)**
- `deferParentConfigDoneActive`: Delays parent configuration to allow child setup
- Prevents premature target resume in multi-session scenarios
- Time-bounded deferral with automatic fallback (1.5s timeout)

## Key Methods

**Connection Management**
- `connect()` (L395-439): Establishes TCP connection with comprehensive error handling
- `disconnect()`/`shutdown()` (L722-758): Graceful cleanup of resources and child sessions
- `cleanup()` (L760-781): Cleans up pending requests, buffers, and event listeners

**Request Processing**
- `sendRequest<T>()` (L441-696): Main request dispatcher with routing, timeout, and policy integration
- Handles breakpoint mirroring for child sessions
- Implements adapter ID normalization for initialize requests

**Utility Methods**
- `waitInitialized()` (L359-380): Waits for adapter initialization with timeout
- `appendTrace()` (L340-351): Optional message tracing to file
- `sendResponse()` (L710-720): Sends responses to adapter reverse requests

## Dependencies
- `@vscode/debugprotocol`: DAP message types and interfaces
- `@debugmcp/shared`: Policy system and configuration types
- `ChildSessionManager`: Manages child debug session lifecycle
- Network: `net.Socket` for TCP communication
- Logging: Custom logger with structured output

## Critical Invariants
- Buffer management must maintain message boundaries per DAP specification
- Request sequence numbers must be unique and properly tracked
- Child session routing decisions are policy-driven and context-aware
- Configuration deferral prevents race conditions in multi-session scenarios
- All pending requests must be cleaned up on disconnect to prevent memory leaks

## Notable Patterns
- Policy pattern for adapter-specific behavior configuration
- Event forwarding between parent and child sessions
- Graceful degradation when child sessions fail
- Time-bounded operations with configurable timeouts
- Comprehensive error handling with structured logging