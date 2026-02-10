# packages/adapter-go/src/go-debug-adapter.ts
@source-hash: 1fefc1d4c0c4d55b
@generated: 2026-02-10T01:19:08Z

**Purpose**: Go debugging adapter that provides Go-specific debug functionality using Delve (dlv) with native DAP support via `dlv dap` command.

**Core Architecture**:
- Extends EventEmitter and implements IDebugAdapter interface (L69-70)
- Uses Delve's native DAP protocol instead of custom protocol translation
- Manages state transitions between UNINITIALIZED → INITIALIZING → READY → CONNECTED → DEBUGGING → DISCONNECTED
- Implements comprehensive caching for executable paths (60-second TTL)

**Key Classes & Interfaces**:

**GoPathCacheEntry** (L41-45): Cache structure for Go/Delve executable paths with version tracking

**GoLaunchConfig** (L50-64): Go-specific launch configuration extending LanguageSpecificLaunchConfig
- Supports debug modes: 'debug', 'test', 'exec', 'replay', 'core'
- Go-specific options: buildFlags, backend, stackTraceDepth, goroutine filtering
- Path substitution for source mapping

**GoDebugAdapter** (L69-650): Main adapter implementation
- **State Management** (L132-151): Tracks adapter lifecycle with event emission
- **Environment Validation** (L155-223): Validates Go 1.18+ and Delve DAP support
- **Executable Resolution** (L244-272): Resolves Delve (not Go) executable with caching
- **DAP Protocol Handling** (L349-398): Maps DAP events to adapter state, delegates requests to DAP client
- **Connection Management** (L401-416): Simple connected state tracking
- **Feature Support** (L485-589): Comprehensive Go debugging capabilities

**Critical Methods**:
- `initialize()` (L92-120): Validates environment and transitions to READY state
- `validateEnvironment()` (L155-223): Checks Go 1.18+, Delve installation, and DAP support
- `resolveExecutablePath()` (L244-264): Returns Delve path (not Go), implements caching
- `buildAdapterCommand()` (L276-295): Constructs `dlv dap --listen=host:port` command
- `transformLaunchConfig()` (L307-338): Converts generic config to Go-specific with defaults
- `handleDapEvent()` (L356-394): Maps DAP events to state transitions and thread tracking

**Dependencies**:
- @vscode/debugprotocol for DAP types
- @debugmcp/shared for adapter interfaces and types
- ./utils/go-utils.js for Go/Delve detection utilities

**Key Design Patterns**:
- Caching pattern for executable path resolution with TTL expiration
- Event-driven state management with EventEmitter
- Template method pattern for adapter lifecycle
- Delegation pattern for DAP protocol handling

**Configuration Defaults**:
- stopOnEntry: false (prevents Delve "unknown goroutine" issues)
- stackTraceDepth: 50
- hideSystemGoroutines: true
- Default mode: 'debug'

**Error Handling**:
- Translates common Go/Delve errors to user-friendly messages
- Provides installation instructions for missing dependencies
- Recoverable vs non-recoverable error classification

**Platform Considerations**:
- Windows executable name handling (.exe suffix)
- Cross-platform path resolution via getGoSearchPaths()
- Environment variable passthrough to child processes