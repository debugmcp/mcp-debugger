# src/proxy/minimal-dap.ts
@source-hash: e8ee3537abe0deea
@generated: 2026-02-10T00:42:01Z

## MinimalDapClient - DAP Protocol Client with Multi-Session Support

**Purpose**: A sophisticated Debug Adapter Protocol (DAP) client implementation that manages debugging sessions with support for child session adoption, reverse request handling, and policy-driven behavior configuration.

### Core Architecture

**MinimalDapClient class (L35-782)** extends EventEmitter to provide:
- TCP socket-based DAP protocol communication with proper buffer management
- Multi-session debugging with child session adoption capabilities  
- Policy-driven adapter behavior customization
- Request/response correlation with timeout handling
- Protocol message parsing compatible with VSCode's implementation

### Key Components

**Connection Management (L395-439)**:
- `connect()`: Establishes TCP connection using net.createConnection
- Socket event handlers for data, error, and close events
- Promise-based connection with proper error handling during connection phase

**Protocol Message Handling (L141-199, L201-338)**:
- `handleData()`: Implements VSCode-compatible buffer management with Content-Length header parsing
- `handleProtocolMessage()`: Routes responses, events, and reverse requests appropriately
- Support for tracing via DAP_TRACE_FILE environment variable

**Request/Response System (L441-696)**:
- `sendRequest<T>()`: Generic method for sending DAP requests with timeout and response correlation
- Automatic request routing to child sessions based on policy configuration
- Special handling for `configurationDone` deferral to prevent premature process resumption
- Breakpoint mirroring to child sessions via ChildSessionManager

**Child Session Management (L100-134)**:
- Integration with ChildSessionManager for handling spawned debugging sessions
- Event forwarding from child sessions to parent client
- Active child tracking and request routing logic
- Policy-driven child session creation and adoption

### Policy Integration

**Adapter Policy System (L55-87)**:
- `AdapterPolicy` configuration drives client behavior via `DapClientBehavior`
- Configurable reverse request handling, child session routing, and adapter ID normalization
- Support for `deferParentConfigDone`, `stackTraceRequiresChild`, and other policy flags

**Reverse Request Handling (L272-318)**:
- Policy-driven handling of adapter-initiated requests (runInTerminal, etc.)
- Fallback to default handling for unrecognized requests
- Child session creation triggered by policy decisions

### Request Routing Logic (L489-603)**:
- Child session routing based on `childSessionManager.shouldRouteToChild()`
- Special stackTrace handling with configurable child wait timeout
- Graceful fallback to parent session when child unavailable

### State Management

**Connection State (L36-53)**:
- Socket connection tracking with disconnect protection
- Buffer management for partial message handling
- Request sequence numbering and pending request correlation

**Session State (L49-74)**:
- Child session tracking via Map<string, MinimalDapClient>
- Breakpoint storage for child session mirroring
- Deferred configuration state for multi-session coordination

### Key Dependencies
- `@vscode/debugprotocol`: DAP type definitions
- `ChildSessionManager`: Child session lifecycle management
- `AdapterPolicy` from `@debugmcp/shared`: Policy configuration system
- Standard Node.js `net` and `events` modules

### Critical Behaviors
- Compatible with VSCode's DAP implementation for message parsing
- Thread-safe request correlation with automatic timeout cleanup
- Policy-driven child session adoption with configurable wait timeouts
- Graceful degradation when child sessions become unavailable
- Comprehensive logging for debugging multi-session scenarios