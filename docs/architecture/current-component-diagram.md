# Current Component Architecture

## System Overview

```mermaid
graph TD
    Client[MCP Client] -->|MCP Protocol| Server[server.ts]
    Server -->|Creates/Manages| SM[SessionManager]
    SM -->|Creates| PM[ProxyManager]
    PM -->|Spawns| PA[Python Adapter Process]
    PA -->|DAP Protocol| DP[debugpy]
    DP -->|Controls| PY[Python Script]
    
    SM -->|Uses| PU[python-utils.ts]
    SM -->|Uses| PT[PathTranslator]
    SM -->|Stores| SS[SessionStore]
    
    style PA fill:#f9f,stroke:#333,stroke-width:2px
    style DP fill:#f9f,stroke:#333,stroke-width:2px
    style PU fill:#f9f,stroke:#333,stroke-width:2px
    
    classDef pythonSpecific fill:#f9f,stroke:#333,stroke-width:2px
    classDef coreComponent fill:#9cf,stroke:#333,stroke-width:2px
    classDef protocol fill:#ff9,stroke:#333,stroke-width:2px
```

## Component Responsibilities

| Component | Responsibility | Python Coupling | Refactoring Priority |
|-----------|---------------|-----------------|---------------------|
| **server.ts** | MCP protocol handling, tool registration | LOW - Language validation only | MEDIUM |
| **SessionManager** | Session lifecycle, debugging orchestration | **CRITICAL** - Python path resolution, debugpy assumptions | **HIGH** |
| **ProxyManager** | Process spawning, DAP communication | **CRITICAL** - Hardcoded debugpy commands | **HIGH** |
| **SessionStore** | Session state persistence | LOW - Python defaults | LOW |
| **python-utils.ts** | Python executable discovery | **CRITICAL** - Entirely Python-specific | Keep as-is |
| **PathTranslator** | Container/host path translation | NONE - Language agnostic | NONE |
| **DebugpyAdapterManager** | debugpy process management | **CRITICAL** - debugpy specific | Replace with adapters |

## Session Creation Sequence

```mermaid
sequenceDiagram
    participant C as MCP Client
    participant S as server.ts
    participant SM as SessionManager
    participant SS as SessionStore
    participant PU as python-utils
    
    C->>S: create_debug_session(language='python')
    S->>S: Validate language === 'python' ❌
    S->>SM: createSession({language, executablePath})
    SM->>SS: createSession()
    SS->>SS: Set default executablePath
    SM->>PU: findPythonExecutable() ❌
    PU-->>SM: Python path
    SM->>SM: Store executable path ❌
    SM-->>S: SessionInfo
    S-->>C: {sessionId, success}
    
    Note over S: ❌ = Python-specific logic
```

## Debug Session Lifecycle

```mermaid
sequenceDiagram
    participant C as MCP Client
    participant S as server.ts
    participant SM as SessionManager
    participant PM as ProxyManager
    participant PA as Python Adapter
    participant DP as debugpy
    
    C->>S: start_debugging(sessionId, script)
    S->>SM: startDebugging()
    SM->>SM: Resolve Python path ❌
    SM->>PM: start(config)
    PM->>PM: Build debugpy command ❌
    PM->>PA: spawn('python -m debugpy.adapter')
    PA->>DP: Connect DAP
    DP-->>PA: Ready
    PA-->>PM: adapter-configured
    PM-->>SM: initialized
    SM-->>S: {success: true}
    S-->>C: Debug session started
```

## Breakpoint Setting Flow

```mermaid
sequenceDiagram
    participant C as MCP Client
    participant S as server.ts
    participant SM as SessionManager
    participant PM as ProxyManager
    participant DP as debugpy
    
    C->>S: set_breakpoint(file, line)
    S->>SM: setBreakpoint()
    SM->>PM: sendDapRequest('setBreakpoints')
    PM->>DP: DAP setBreakpoints
    DP-->>PM: Breakpoint verified
    PM-->>SM: Response
    SM-->>S: Breakpoint info
    S-->>C: {verified, id}
```

## Current Python Coupling Points

```mermaid
graph LR
    subgraph "MCP API Layer"
        A[server.ts<br/>Lines 73-75]
    end
    
    subgraph "Session Management"
        B[SessionManager<br/>Lines 166-196]
        C[SessionStore<br/>Line 64]
    end
    
    subgraph "Process Management"
        D[ProxyManager<br/>Lines 35-36]
        E[DebugpyAdapterManager<br/>Lines 26-32]
    end
    
    subgraph "Utilities"
        F[python-utils.ts<br/>Entire file]
    end
    
    A -->|validates| B
    B -->|uses| F
    B -->|creates| D
    D -->|delegates to| E
    
    style A fill:#fcc,stroke:#333,stroke-width:2px
    style B fill:#f99,stroke:#333,stroke-width:2px
    style C fill:#fdd,stroke:#333,stroke-width:2px
    style D fill:#f99,stroke:#333,stroke-width:2px
    style E fill:#f66,stroke:#333,stroke-width:2px
    style F fill:#f66,stroke:#333,stroke-width:2px
```

## Data Flow Analysis

### Session Creation Data Flow
```
1. Client Request
   └─> language: 'python' (hardcoded enum value)
   └─> executablePath?: string (optional)

2. Server Validation
   └─> if (language !== 'python') throw ❌

3. SessionManager Processing
   └─> Resolve executable path (platform-specific) ❌
   └─> Store in session.executablePath ❌

4. SessionStore
   └─> Default to env.PYTHON_PATH or 'python'/'python3' ❌
```

### Configuration Data Flow
```
ProxyConfig {
  executablePath: string  ❌ Language-specific field
  adapterHost: string
  adapterPort: number
  scriptPath: string
  initialBreakpoints: []
}
```

## Component Dependencies Graph

```mermaid
graph BT
    subgraph "External Dependencies"
        PY[Python Runtime]
        DP[debugpy Package]
    end
    
    subgraph "Core Components"
        SM[SessionManager]
        PM[ProxyManager]
        PA[ProxyAdapterManager]
    end
    
    subgraph "Utilities"
        PU[python-utils]
        PT[PathTranslator]
    end
    
    SM --> PU
    SM --> PM
    PM --> PA
    PA --> PY
    PA --> DP
    PU --> PY
    
    style PY fill:#f9f,stroke:#333,stroke-width:2px
    style DP fill:#f9f,stroke:#333,stroke-width:2px
    style PU fill:#f9f,stroke:#333,stroke-width:2px
    style PA fill:#fcc,stroke:#333,stroke-width:2px
```

## Event Flow Patterns

### Current Event Handling
```mermaid
stateDiagram-v2
    [*] --> Created: Session Created
    Created --> Initializing: startDebugging()
    Initializing --> Running: Python found ✓
    Initializing --> Error: Python not found ✗
    Running --> Paused: Breakpoint hit
    Paused --> Running: Continue
    Running --> Stopped: Program exits
    Paused --> Stopped: Terminate
    Error --> [*]
    Stopped --> [*]
    
    note right of Initializing: Python discovery happens here
    note right of Running: debugpy controls execution
```

## Key Architecture Insights

### 1. **Proxy Pattern Already Exists**
The system already uses a proxy pattern (ProxyManager → Adapter Process), which is perfect for multi-language support. We just need to make it language-agnostic.

### 2. **Clear Separation Points**
- **Good**: python-utils.ts is isolated
- **Bad**: SessionManager mixes session logic with Python logic
- **Ugly**: ProxyManager hardcodes debugpy commands

### 3. **Single Language Assumption**
The `DebugLanguage` enum having only `PYTHON` means:
- No existing multi-language code to break
- All current code assumes Python
- Clean slate for adapter pattern

### 4. **Event-Driven Architecture**
The system is already event-driven (DAP events), making it easier to abstract language-specific behavior.

## Refactoring Opportunities

### Current Anti-Pattern
```
Client → Server → SessionManager → Python Logic → ProxyManager → debugpy
                          ↓
                    python-utils
```

### Target Architecture
```
Client → Server → SessionManager → IDebugAdapter → Language-Specific Adapter
                                         ↓
                                   AdapterFactory
                                         ↓
                              PythonAdapter / NodeAdapter / etc.
```

## Component Coupling Matrix

| Component | Depends On | Python Coupling | Refactor Difficulty |
|-----------|------------|-----------------|-------------------|
| server.ts | SessionManager | Language validation | LOW |
| SessionManager | python-utils, ProxyManager | Path resolution, config | HIGH |
| ProxyManager | DebugpyAdapterManager | Command building | MEDIUM |
| SessionStore | None (uses defaults) | Default paths | LOW |
| PathTranslator | None | None | NONE |
| python-utils | Python runtime | Entire purpose | N/A (Keep) |

## System Constraints

1. **MCP Protocol**: Fixed interface, must maintain compatibility
2. **DAP Protocol**: Standard debug protocol, language-agnostic
3. **Current Tests**: 50+ tests assume Python behavior
4. **Docker**: No Python installed in container (relies on host)

## Next Steps for Refactoring

1. **Extract IDebugAdapter interface**
2. **Move Python logic from SessionManager to PythonAdapter**
3. **Create AdapterFactory for language selection**
4. **Update ProxyManager to be language-agnostic**
5. **Remove hardcoded language validation from server.ts**
