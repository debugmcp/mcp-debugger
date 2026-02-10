# src/proxy/dap-proxy-adapter-manager.ts
@source-hash: b8bbb1e60f3af5b8
@generated: 2026-02-09T18:15:11Z

**Primary Purpose**: Generic adapter process manager for Debug Adapter Protocol (DAP) proxy that spawns and manages any language-agnostic debug adapter process.

## Key Classes & Functions

### GenericAdapterConfig Interface (L17-25)
Configuration structure for spawning debug adapters:
- `command` & `args`: Executable command and arguments  
- `host` & `port`: Network binding configuration
- `logDir`: Directory for adapter logs
- `cwd` & `env`: Optional working directory and environment variables

### GenericAdapterManager Class (L30-195)
Main adapter lifecycle manager with dependency injection pattern:

**Constructor** (L31-35): Takes `IProcessSpawner`, `ILogger`, `IFileSystem` dependencies

**ensureLogDirectory()** (L40-49): Creates log directory with error handling and logging

**spawn()** (L54-130): Core method that:
- Ensures log directory exists
- Configures spawn options with stdio inheritance and detached mode
- Logs extensive debugging information including environment variables
- Spawns process via injected spawner
- Sets up process event handlers
- Returns `AdapterSpawnResult` with process and PID

**setupProcessHandlers()** (L135-143): Private method setting up error and exit event listeners

**shutdown()** (L148-194): Graceful termination with escalating force:
- Sends SIGTERM first, waits 300ms
- Falls back to SIGKILL if needed
- Windows-specific taskkill fallback for process tree termination

## Key Dependencies
- `child_process.ChildProcess`: Core process management
- Custom interfaces from `./dap-proxy-interfaces.js`: `IProcessSpawner`, `ILogger`, `IFileSystem`, `AdapterSpawnResult`

## Architectural Patterns
- **Dependency Injection**: All external dependencies injected via constructor
- **Platform Abstraction**: Uses injected spawner rather than direct Node.js APIs
- **Progressive Termination**: Graceful → forceful → platform-specific shutdown sequence
- **Extensive Logging**: Debug-friendly with environment variable inspection and command logging

## Critical Constraints
- Processes spawned as detached with `unref()` to prevent blocking proxy lifecycle
- Windows-specific handling for process tree termination
- stdio configured as `['ignore', 'inherit', 'inherit', 'ipc']` for IPC communication
- Environment variable inspection focuses on Node.js debugging flags (`--inspect`, `NODE_DEBUG`, etc.)

## Notable Implementation Details
- Dynamic `any` typing used for spawn options to handle optional `cwd` property (L64-65)
- Environment variable logging includes detection of inspector-related variables
- Error handling gracefully handles unref() failures on older Node versions
- Process termination includes 300ms grace period before escalation