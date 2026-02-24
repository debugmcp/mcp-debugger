# src\proxy\dap-proxy-adapter-manager.ts
@source-hash: abceb8cfab398064
@generated: 2026-02-24T01:54:11Z

This file implements a language-agnostic debug adapter process manager for the DAP (Debug Adapter Protocol) proxy system. It provides a generic way to spawn and manage any debug adapter process, handling process lifecycle, logging, and graceful shutdown.

## Core Components

**GenericAdapterConfig interface (L17-25)**: Defines configuration for spawning debug adapters including command, arguments, host/port, log directory, optional working directory and environment variables.

**GenericAdapterManager class (L30-205)**: Main service class that orchestrates debug adapter process lifecycle:
- Constructor (L31-35) accepts dependencies for process spawning, logging, and file system operations
- `ensureLogDirectory()` (L40-49) creates log directories with error handling
- `spawn()` (L54-130) core method that spawns adapter processes with detailed logging and configuration
- `setupProcessHandlers()` (L135-153) private method that configures error handling, stderr capture, and exit logging
- `shutdown()` (L158-204) graceful termination with SIGTERM/SIGKILL fallback and Windows-specific process tree killing

## Key Features

**Process Spawning**: Uses dependency-injected IProcessSpawner to launch debug adapters with configurable stdio, environment, and detachment settings. Processes are spawned detached and unref'd to prevent blocking proxy lifecycle.

**Cross-Platform Support**: Handles Windows-specific concerns including `windowsHide` option and `taskkill` fallback for process tree termination.

**Comprehensive Logging**: Extensive debug logging for spawn configuration, environment variables, command execution, and process lifecycle events. Logs critical environment variables like NODE_OPTIONS, DEBUG flags, and inspector-related variables.

**Error Handling**: Robust error handling for directory creation, process spawning failures, and graceful shutdown scenarios with fallback termination strategies.

## Dependencies

- Imports from `./dap-proxy-interfaces.js`: IProcessSpawner, ILogger, IFileSystem, AdapterSpawnResult
- Uses Node.js ChildProcess for process management
- Platform detection via `globalThis.process.platform`

## Notable Patterns

- Dependency injection pattern for testability and modularity
- Graceful degradation in shutdown with signal escalation (SIGTERM → SIGKILL → taskkill)
- Defensive programming with null checks and try-catch blocks
- Detailed diagnostic logging for debugging complex process spawning scenarios