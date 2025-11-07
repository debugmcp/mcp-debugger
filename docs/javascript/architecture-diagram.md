# JavaScript Adapter Architecture Diagram

## Multi-Session Debugging Flow

```mermaid
sequenceDiagram
    participant Client as MCP Client
    participant SM as Session Manager
    participant PM as ProxyManager
    participant Parent as Parent Session (js-debug)
    participant Child as Child Session (Node.js Process)
    
    Client->>SM: create_debug_session("javascript")
    SM->>PM: Initialize ProxyManager
    PM->>Parent: Launch js-debug adapter
    
    Client->>SM: set_breakpoint(file, line)
    SM->>PM: Queue breakpoint
    
    Client->>SM: start_debugging(script.js)
    SM->>PM: Launch with breakpoints
    PM->>Parent: initialize + launch
    
    Note over Parent: js-debug starts Node.js
    Parent-->>PM: startDebugging request
    Note over PM: Creates child session
    PM->>Child: Adopt with __pendingTargetId
    
    Note over Child: Node.js hits breakpoint
    Child-->>PM: stopped event
    PM-->>SM: State: paused
    SM-->>Client: Debugging paused at breakpoint
    
    Client->>SM: get_local_variables()
    SM->>PM: Get variables
    PM->>Child: Route to child session
    Child-->>PM: Variables data
    PM-->>SM: Variables response
    SM-->>Client: {a: 1, b: 2}
```

## Component Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                       MCP Debugger Server                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐                                        │
│  │ Session Manager │                                        │
│  └────────┬────────┘                                        │
│           │                                                 │
│  ┌────────▼────────┐                                        │
│  │  ProxyManager   │ ◄─── Manages DAP communication         │
│  └────────┬────────┘                                        │
│           │                                                 │
│  ┌────────▼──────────────────────────── ┐                   │
│  │    JavaScript Adapter                │                   │
│  │  ┌────────────────────────────┐      │                   │
│  │  │  ChildSessionManager       │      │                   │
│  │  │  - Handles startDebugging  │      │                   │
│  │  │  - Routes commands         │      │                   │
│  │  └────────────────────────────┘      │                   │
│  └──────────────────────────────────────┘                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    js-debug (VSCode)                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐        ┌─────────────────┐             │
│  │  Parent Session │───────▶│  Child Session │             │
│  │  (Initialization)│       │  (Debug Target) │             │
│  └─────────────────┘        └─────────────────┘             │
│                                      │                      │
│                                      ▼                      │
│                            ┌─────────────────┐              │
│                            │   Node.js       │              │
│                            │   Process       │              │
│                            └─────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. ProxyManager
- Manages IPC communication with js-debug process
- Handles DAP protocol translation
- Manages request/response tracking

### 2. ChildSessionManager
- Detects and adopts child sessions via `__pendingTargetId`
- Routes commands between parent and child sessions
- Maintains session state synchronization

### 3. Parent Session
- Handles adapter initialization
- Manages launch configuration
- Creates child process for debugging

### 4. Child Session
- Actual debugging target (Node.js process)
- Handles breakpoints, stepping, and variable inspection
- Sends events back through the chain

## Message Flow Examples

### Setting a Breakpoint
```
Client → SessionManager → ProxyManager → Parent → Child → Node.js
```

### Getting Variables
```
Client → SessionManager → ProxyManager → ChildSessionManager → Child → Node.js
                                              ↑
                                    (Routes to active child)
```

### Stepping Through Code
```
Client → SessionManager → ProxyManager → Child → Node.js
                              ↑
                    (Direct routing after adoption)
```

## Implementation Notes

1. **Session Adoption**: The key innovation is detecting when js-debug creates a child session and adopting it seamlessly.

2. **Command Routing**: Commands are intelligently routed based on session state:
   - Initialization commands → Parent session
   - Debugging commands → Child session

3. **Event Propagation**: Events from the child session bubble up through the ProxyManager to the client.

4. **Vendor Management**: The js-debug vendored files are carefully managed to avoid conflicts and minimize bundle size.

## Future Enhancements

- **Chrome Debugging**: Add `chrome-pwa` adapter support
- **Remote Debugging**: Support attaching to remote Node.js processes
- **Workspace Support**: Handle multi-root workspaces
- **Source Map Improvements**: Enhanced TypeScript source map resolution
