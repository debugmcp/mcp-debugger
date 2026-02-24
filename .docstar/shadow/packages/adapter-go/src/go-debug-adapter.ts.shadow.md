# packages\adapter-go\src\go-debug-adapter.ts
@source-hash: 22344b4ddc0d7102
@generated: 2026-02-24T01:54:20Z

## Go Debug Adapter Implementation

This file implements a Go-specific debug adapter using Delve (dlv) that provides DAP (Debug Adapter Protocol) support for Go debugging. The adapter manages Delve's DAP mode (`dlv dap`) to enable debugging Go programs through VS Code and other DAP-compatible clients.

### Core Components

**GoDebugAdapter Class (L69-651)**
- Primary implementation of IDebugAdapter interface for Go debugging
- Extends EventEmitter for state change notifications
- Manages adapter lifecycle, environment validation, and DAP protocol handling
- Maintains internal state tracking (connected, currentThreadId, caches)

**GoLaunchConfig Interface (L50-64)**
- Extends LanguageSpecificLaunchConfig with Go-specific debugging options
- Supports multiple debug modes: debug, test, exec, replay, core
- Includes Delve-specific settings: buildFlags, backend, stackTraceDepth, goroutine filtering
- Provides path substitution for remote debugging scenarios

**GoPathCacheEntry Interface (L41-45)**
- Caching structure for executable path resolution with timestamps
- Stores path, timestamp, and optional version information
- Used for both Go and Delve executable caching (1-minute TTL)

### Key Functionality

**Environment Validation (L155-224)**
- Validates Go version (requires 1.18+ for Delve compatibility)
- Checks Delve installation and DAP support via `checkDelveDapSupport()`
- Returns structured ValidationResult with errors and warnings
- Provides recovery instructions for common issues

**Executable Management (L245-273)**
- Resolves Delve executable path with caching
- Uses `findDelveExecutable()` utility for cross-platform discovery
- Implements search path resolution via `getGoSearchPaths()`
- Returns platform-specific executable names (dlv/dlv.exe)

**Debug Configuration (L308-346)**
- Transforms generic launch config to Go-specific GoLaunchConfig
- Sets sensible defaults: stopOnEntry=false, stackTraceDepth=50, hideSystemGoroutines=true
- Maps common properties (cwd→dlvCwd, preserves env/args)
- Configures Delve for optimal debugging experience

**DAP Protocol Integration (L350-399)**
- Handles DAP events: stopped, continued, terminated, thread, output, breakpoint
- Maps events to internal adapter state transitions
- Maintains current thread ID for debugging session context
- Emits events for external consumers

**Connection Management (L403-417)**
- Manages adapter connection state and transitions
- Emits connection lifecycle events
- Tracks connected status for debugging sessions

**Feature Support (L486-590)**
- Declares support for core debugging features: breakpoints, evaluation, variables
- Implements comprehensive capability reporting for DAP clients
- Defines exception breakpoint filters for Go panics and fatal errors
- Specifies supported debugging operations and limitations

### Dependencies

- **@vscode/debugprotocol**: DAP type definitions and protocol structures
- **@debugmcp/shared**: Core adapter interfaces, types, and utilities
- **./utils/go-utils.js**: Go-specific utilities for executable discovery and version checking
- **events.EventEmitter**: State change and event notification system

### Caching Strategy

The adapter implements two-level caching:
- **goPathCache**: Caches Go executable paths and versions
- **delvePathCache**: Caches Delve executable paths and versions
- **1-minute TTL**: Balances performance with freshness for development workflows

### Error Handling

Provides contextual error translation for common Go debugging issues:
- Missing Go/Delve installations with install commands
- Permission and process attachment failures
- Version compatibility problems with upgrade instructions

### State Management

Tracks adapter state through well-defined transitions:
UNINITIALIZED → INITIALIZING → READY → CONNECTED → DEBUGGING
Emits stateChanged events for external state monitoring and UI updates.