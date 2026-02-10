# src/proxy/dap-proxy-adapter-manager.ts
@source-hash: 2618878a890a9578
@generated: 2026-02-10T01:19:01Z

**Primary Purpose:** Generic debug adapter process manager for DAP (Debug Adapter Protocol) proxy that spawns and manages any debug adapter process in a language-agnostic way.

**Key Components:**

- **GenericAdapterConfig (L17-25):** Configuration interface defining command, args, host, port, logDir, and optional cwd/env for adapter spawning
- **GenericAdapterManager (L30-195):** Main manager class with dependency injection for process spawner, logger, and filesystem

**Core Methods:**

- **ensureLogDirectory() (L40-49):** Creates log directory if it doesn't exist, throws on failure
- **spawn() (L54-130):** Primary method that spawns debug adapter process with extensive logging and configuration
- **setupProcessHandlers() (L135-143):** Attaches error and exit event handlers to spawned process
- **shutdown() (L148-194):** Graceful termination with escalating signals (SIGTERM → SIGKILL → taskkill on Windows)

**Key Dependencies:**
- IProcessSpawner, ILogger, IFileSystem interfaces from './dap-proxy-interfaces.js'
- Returns AdapterSpawnResult containing process and PID

**Architecture Patterns:**
- Dependency injection via constructor
- Comprehensive error handling with message extraction
- Platform-specific behavior (Windows taskkill fallback)
- Process lifecycle management with unref() for non-blocking proxy lifecycle

**Critical Spawn Configuration (L65-75):**
- stdio: ['ignore', 'inherit', 'inherit', 'ipc'] for IPC communication
- detached: true, windowsHide: true for background execution
- Conditional cwd setting only if explicitly provided
- Environment variable inheritance with logging

**Process Management Features:**
- Extensive logging of environment variables and spawn configuration
- Inspector/debug flag detection and logging
- Graceful shutdown with 300ms timeout between signals
- Windows-specific force termination via taskkill
- Process unreferencing to prevent blocking proxy lifecycle

**Error Handling:**
- Try-catch blocks around critical operations
- Fallback mechanisms for platform-specific operations
- Detailed error logging with context