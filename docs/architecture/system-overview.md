# MCP Debug Server - System Architecture Overview

The MCP Debug Server provides a Model Context Protocol (MCP) interface for interactive debugging, enabling LLM agents to debug code with step-through execution, breakpoint management, and variable inspection capabilities.

## High-Level Architecture

```mermaid
graph TB
    subgraph "MCP Client Layer"
        MC[MCP Client<br/>LLM Agent/Claude]
    end

    subgraph "MCP Server Layer"
        MS[MCP Server<br/>index.ts/server.ts]
        SM[SessionManager<br/>session-manager.ts]
    end

    subgraph "Proxy Management Layer"
        PM[ProxyManager<br/>proxy-manager.ts]
        PC[ProxyCore<br/>dap-proxy-core.ts]
        PW[ProxyWorker<br/>dap-proxy-worker.ts]
        PPM[ProcessManager<br/>dap-proxy-process-manager.ts]
    end

    subgraph "Debug Adapter Layer"
        DA[debugpy<br/>Python Debug Adapter]
        PY[Python Process<br/>Target Script]
    end

    MC -->|MCP Protocol| MS
    MS -->|Session Commands| SM
    SM -->|Manages| PM
    PM -->|IPC Messages| PC
    PC -->|Controls| PW
    PW -->|Manages| PPM
    PPM -->|Spawns| DA
    DA -->|DAP Protocol| PY
    
    classDef client fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef server fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef proxy fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px
    classDef adapter fill:#fff3e0,stroke:#e65100,stroke-width:2px
    
    class MC client
    class MS,SM server
    class PM,PC,PW,PPM proxy
    class DA,PY adapter
```

## Component Responsibilities

### 1. MCP Server Layer (`src/server.ts`, `src/index.ts`)
- **Purpose**: Entry point for MCP protocol communication
- **Key Files**: 
  - `src/server.ts` - Main server implementation
  - `src/index.ts` - CLI entry point with transport options (stdio/tcp)
- **Responsibilities**:
  - Handle MCP tool registration and routing
  - Manage server lifecycle and transport modes
  - Route debugging commands to SessionManager

### 2. SessionManager (`src/session/session-manager.ts`)
- **Purpose**: Central orchestrator for debug sessions
- **Key Dependencies**:
  ```typescript
  // From src/session/session-manager.ts, lines 48-56
  export interface SessionManagerDependencies {
    fileSystem: IFileSystem;
    networkManager: INetworkManager;
    logger: ILogger;
    proxyManagerFactory: IProxyManagerFactory;
    sessionStoreFactory: ISessionStoreFactory;
    debugTargetLauncher: IDebugTargetLauncher;
  }
  ```
- **Responsibilities**:
  - Create and manage debug session lifecycle
  - Coordinate ProxyManager instances (one per session)
  - Handle breakpoint management and state synchronization
  - Provide high-level debugging operations (step, continue, evaluate)

### 3. ProxyManager (`src/proxy/proxy-manager.ts`)
- **Purpose**: Manages communication with debug proxy process
- **Key Features**:
  - Spawns and controls proxy worker process
  - Implements typed event system for DAP events
  - Handles request/response correlation with timeout management
- **Event Flow** (from lines 57-67):
  ```typescript
  export interface ProxyManagerEvents {
    'stopped': (threadId: number, reason: string, data?: any) => void;
    'continued': () => void;
    'terminated': () => void;
    'exited': () => void;
    'initialized': () => void;
    'error': (error: Error) => void;
    'exit': (code: number | null, signal?: string) => void;
    'dry-run-complete': (command: string, script: string) => void;
    'adapter-configured': () => void;
  }
  ```

### 4. DAP Proxy Architecture (`src/proxy/dap-proxy-*.ts`)
The proxy system follows a three-layer architecture:

#### a. ProxyCore (`src/proxy/dap-proxy-core.ts`)
- **Purpose**: Pure business logic without side effects
- **Features**:
  - Configurable communication channels (IPC/stdin)
  - Message processing pipeline
  - Global error handling setup
  
#### b. ProxyWorker (`src/proxy/dap-proxy-worker.ts`)
- **Purpose**: Core worker implementing debugging logic
- **State Management**:
  ```typescript
  // From src/proxy/dap-proxy-interfaces.ts
  enum ProxyState {
    UNINITIALIZED,
    INITIALIZING,
    CONNECTED,
    SHUTTING_DOWN,
    TERMINATED
  }
  ```
- **Responsibilities**:
  - Handle initialization and configuration
  - Manage DAP client connection
  - Process debugging commands
  - Track request timeouts

#### c. ProcessManager (`src/proxy/dap-proxy-process-manager.ts`)
- **Purpose**: Manages debugpy adapter process lifecycle
- **Features**:
  - Spawns debugpy with proper arguments
  - Handles process monitoring and cleanup
  - Manages stdout/stderr streams

## Data Flow Sequence

```mermaid
sequenceDiagram
    participant C as MCP Client
    participant S as MCP Server
    participant SM as SessionManager
    participant PM as ProxyManager
    participant PW as ProxyWorker
    participant DA as debugpy
    participant PY as Python Script

    C->>S: create_debug_session
    S->>SM: createSession()
    SM->>SM: Generate sessionId
    SM-->>C: SessionInfo
    
    C->>S: set_breakpoint
    S->>SM: setBreakpoint()
    SM->>SM: Queue breakpoint
    SM-->>C: Breakpoint info
    
    C->>S: start_debugging
    S->>SM: startDebugging()
    SM->>PM: start(ProxyConfig)
    PM->>PW: spawn process
    PW->>DA: spawn debugpy
    DA-->>PW: adapter ready
    PW->>DA: initialize
    PW->>DA: launch request
    PW->>DA: setBreakpoints
    DA-->>PW: initialized event
    PW-->>PM: adapter-configured
    PM-->>SM: state: RUNNING
    SM-->>C: Debug started
    
    Note over DA,PY: Script execution begins
    
    DA-->>PW: stopped event (breakpoint)
    PW-->>PM: stopped event
    PM-->>SM: state: PAUSED
    
    C->>S: get_variables
    S->>SM: getVariables()
    SM->>PM: sendDapRequest('variables')
    PM->>PW: DAP command
    PW->>DA: variables request
    DA-->>PW: variables response
    PW-->>PM: DAP response
    PM-->>SM: Variables data
    SM-->>C: Variable values
```

## Technology Stack

### Core Technologies
- **Runtime**: Node.js 18+ with ES modules
- **Language**: TypeScript 5.x with strict mode
- **Protocol**: Model Context Protocol (MCP) over stdio/TCP
- **Debugging**: Debug Adapter Protocol (DAP) 1.51.0
- **Testing**: Vitest with 90%+ coverage
- **Bundling**: tsup with `noExternal` for self-contained distributions

### Key Dependencies
- `@modelcontextprotocol/sdk` - MCP server implementation
- `@vscode/debugprotocol` - DAP type definitions
- `debug-adapter-client` - DAP client for adapter communication
- `winston` - Structured logging
- `fs-extra` - Enhanced file system operations

### Architecture Patterns
1. **Dependency Injection** - All major components use constructor injection
2. **Factory Pattern** - ProxyManagerFactory, SessionStoreFactory for testability
3. **Event-Driven** - Extensive EventEmitter usage with proper cleanup
4. **Functional Core** - Pure functions in dap-core for state management
5. **Error Boundaries** - Centralized error handling with user-friendly messages

## Deployment Options

### 1. NPX Distribution (Recommended)
```bash
npx @debugmcp/mcp-debugger stdio  # stdio mode
npx @debugmcp/mcp-debugger tcp --port 6111  # TCP mode
```
- Self-contained bundles with all dependencies
- No installation required
- CLI bundle (~3MB) includes all workspace packages
- Proxy bundle includes all proxy dependencies

### 2. Local Node.js
```bash
pnpm install && npm run build
node dist/index.js stdio              # stdio mode
node dist/index.js sse -p 3001       # SSE mode
```

### 3. Docker Container
- Dockerfile configured for both stdio and SSE modes
- Python and debugpy pre-installed in image
- Volume mounting for workspace access
- Uses bundled versions for minimal image size

### 4. Python Launcher
- `mcp-debugger-launcher` package provides easy installation
- Auto-detects Docker or falls back to local Node.js

## Bundle Architecture

The project uses a dual-bundle approach for distribution:

### CLI Bundle (`cli.mjs`)
- Built with tsup using `noExternal: [/./]`
- Includes all workspace dependencies
- ESM format for modern Node.js compatibility
- Entry point for npx distribution

### Proxy Bundle (`proxy-bundle.cjs`)
- Separate bundle for the DAP proxy process
- CommonJS format for child process compatibility
- Includes all proxy dependencies (fs-extra, winston, etc.)
- Auto-detected by proxy bootstrap (no env vars needed)

This architecture enables:
- Zero-dependency npx distribution
- Minimal Docker images without node_modules
- Fast startup times with pre-bundled code
- Simplified deployment across environments

## Security Considerations

1. **Process Isolation** - Each debug session runs in separate process
2. **Path Validation** - Script paths validated before execution
3. **Timeout Protection** - All operations have configurable timeouts
4. **Resource Cleanup** - Automatic cleanup of orphaned processes

## Performance Characteristics

- **Startup Time**: ~1-2s for session initialization
- **Command Latency**: <100ms for most DAP commands
- **Memory Usage**: ~50MB base + ~20MB per active session
- **Concurrent Sessions**: Limited by system resources

## Error Handling Strategy

The system uses centralized error messages (`src/utils/error-messages.ts`) with:
- User-friendly error descriptions
- Troubleshooting suggestions
- Consistent timeout messages
- Detailed logging for debugging

Example from error-messages.ts:
```typescript
proxyInitTimeout: (timeout: number) =>
  `Debug proxy initialization did not complete within ${timeout}s. ` +
  `This may indicate that debugpy failed to start or is not installed. ` +
  `Check that Python and debugpy are properly installed and accessible.`
```

## Next Steps

- See [Component Design](./component-design.md) for detailed component documentation
- See [Testing Architecture](./testing-architecture.md) for test patterns and coverage
- See [Development Guide](../development/setup-guide.md) for getting started
