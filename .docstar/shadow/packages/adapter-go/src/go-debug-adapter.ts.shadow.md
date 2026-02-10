# packages/adapter-go/src/go-debug-adapter.ts
@source-hash: b5757af4ed3b775d
@generated: 2026-02-09T18:14:36Z

## Purpose
Go Debug Adapter implementation using Delve DAP (Debug Adapter Protocol) for debugging Go programs through the VS Code Debug Protocol interface.

## Architecture
- **Primary Class**: `GoDebugAdapter` (L69-653) - Main adapter implementing `IDebugAdapter` interface
- **Configuration Interface**: `GoLaunchConfig` (L50-64) - Go-specific debug launch configuration
- **Caching Interface**: `GoPathCacheEntry` (L41-45) - Cached executable paths with timestamps

## Key Dependencies
- `@vscode/debugprotocol` - Debug Adapter Protocol definitions
- `@debugmcp/shared` - Core adapter interfaces and types
- `./utils/go-utils.js` - Go/Delve utility functions (findDelveExecutable, getGoVersion, etc.)

## Core Functionality

### Environment Management
- `validateEnvironment()` (L155-223) - Validates Go 1.18+ and Delve DAP support
- `resolveExecutablePath()` (L244-264) - Resolves Delve executable with caching
- `getRequiredDependencies()` (L225-240) - Returns Go and Delve dependency info

### State Management
- State tracking via `AdapterState` enum with transitions (L147-151)
- Connection status management (`connected` flag, L403-419)
- Current thread tracking (`currentThreadId`, L143-145)

### Configuration Handling
- `transformLaunchConfig()` (L307-336) - Transforms generic config to Go-specific
- `buildAdapterCommand()` (L276-295) - Builds `dlv dap` command with host/port
- Default Go debugging settings (stack depth: 50, hide system goroutines, etc.)

### DAP Protocol Integration
- `handleDapEvent()` (L356-394) - Maps DAP events to adapter state changes
- Event forwarding for stopped/continued/terminated/output events
- State transitions based on debug events

### Feature Support
- `supportsFeature()` (L488-503) - Declares supported debug features
- `getCapabilities()` (L537-592) - Comprehensive DAP capabilities declaration
- Supports conditional breakpoints, function breakpoints, variable evaluation, log points

### Error Handling
- `translateErrorMessage()` (L460-484) - Go-specific error message translation
- `getInstallationInstructions()` (L423-445) - Detailed setup instructions
- Environment validation with recoverable/non-recoverable error classification

## Caching Strategy
- Path caching with 60-second timeout (`cacheTimeout`, L79)
- Separate caches for Go (`goPathCache`) and Delve (`delvePathCache`) executables
- Version caching within path cache entries

## Debug Modes
Supports Go debug modes: `debug`, `test`, `exec`, `replay`, `core` via `mode` configuration property.

## Key Architectural Decisions
1. Uses Delve's native DAP support (`dlv dap`) rather than custom protocol translation
2. Implements comprehensive caching to avoid repeated executable lookups
3. Separates Go and Delve path resolution for flexibility
4. Provides extensive capability declarations for rich debugging features