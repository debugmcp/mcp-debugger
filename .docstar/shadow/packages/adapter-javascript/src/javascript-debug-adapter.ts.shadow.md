# packages/adapter-javascript/src/javascript-debug-adapter.ts
@source-hash: 0283cded9acfb98e
@generated: 2026-02-09T18:14:55Z

This file implements `JavascriptDebugAdapter` (L37), a comprehensive debug adapter for JavaScript and TypeScript that implements the `IDebugAdapter` interface from `@debugmcp/shared`.

## Core Purpose
The adapter serves as a bridge between VS Code's Debug Adapter Protocol (DAP) and the underlying js-debug engine, handling JavaScript/TypeScript debugging sessions with automatic runtime detection and configuration transformation.

## Key Components

### Main Class: JavascriptDebugAdapter (L37-929)
- **State Management**: Tracks adapter lifecycle through `AdapterState` enum (L42, L119-146)
- **Runtime Detection**: Caches Node.js path and TypeScript runners for performance (L48-51, L922-928)
- **Event Emission**: Extends EventEmitter for lifecycle events (initialized, connected, disconnected, disposed)

### Critical Methods

**Lifecycle Management (L59-115)**
- `initialize()` (L59-94): Validates environment, transitions to READY state
- `dispose()` (L96-115): Cleans up resources and emits lifecycle events
- `transitionTo()` (L142-146): Private state transition with event emission

**Environment Validation (L150-212)**
- `validateEnvironment()` (L150-201): Checks for js-debug adapter binary in multiple possible locations
- `getRequiredDependencies()` (L203-212): Returns Node.js dependency info

**Executable Resolution (L216-242)**
- `resolveExecutablePath()` (L216-233): Cached Node.js executable discovery with override support
- `getExecutableSearchPaths()` (L239-242): Returns system PATH directories

**Adapter Command Building (L246-333)**
- `buildAdapterCommand()` (L246-333): Constructs command to launch js-debug in TCP mode
- Validates adapter port requirement and finds vendored js-debug binary
- Sets NODE_OPTIONS with memory allocation flags

**Launch Configuration Transform (L345-555)**
- `transformLaunchConfig()` (L345-555): Core method converting generic config to js-debug specific
- **TypeScript Detection**: File extension pattern matching (L375)
- **Runtime Selection**: Synchronous detection of tsx/ts-node executables (L450-462)
- **Runtime Args Computation**: Adds TypeScript transpilation hooks when needed (L464-552)
- **Inspector Flag Handling**: Normalizes Node.js --inspect flags for consistent behavior (L522-552)

**DAP Protocol Handling (L585-658)**
- `sendDapRequest()` (L585-614): Validates and processes DAP requests (transport delegated to ProxyManager)
- `handleDapEvent()` (L616-654): Processes DAP events, tracks thread state, emits to consumers
- `handleDapResponse()` (L656-658): No-op stub for Task 1

**Connection Management (L662-680)**
- `connect()` (L662-668): Logs intent, updates state (actual transport handled by ProxyManager)
- `disconnect()` (L670-676): State cleanup and event emission

**Feature Support (L716-763)**
- `supportsFeature()` (L716-730): Returns support status for debug features
- `getCapabilities()` (L747-763): Comprehensive DAP capabilities declaration

### Utility Methods

**Runtime Analysis (L557-572, L795-856)**
- `normalizeBinary()` (L557-566): Path normalization for cross-platform compatibility
- `isNodeRuntime()` (L568-572): Detects Node.js executable variants
- `normalizeAndDedupeArgs()` (L795-823): Deduplicates runtime arguments intelligently
- `hasPairArgs()` (L825-830): Checks for flag-value pairs in argument arrays

**Async Runtime Helpers (L767-917)**
- `determineRuntimeExecutable()` (L767-793): Async TypeScript runner selection
- `determineRuntimeArgs()` (L858-917): Async runtime argument computation with ESM/tsconfig-paths support
- `detectTypeScriptRunners()` (L921-928): Cached async discovery of tsx/ts-node

## Dependencies
- **External**: `events.EventEmitter`, Node.js core modules (path, fs), `@vscode/debugprotocol`
- **Internal**: `@debugmcp/shared` types/enums, local utilities for executable resolution, TypeScript detection, config transformation
- **Vendored**: Relies on js-debug adapter binary in `vendor/js-debug/` directory

## Architecture Patterns
- **Caching Strategy**: Per-instance memoization for expensive operations (executable paths, TS runners)
- **State Machine**: Explicit state transitions with event emission for lifecycle tracking
- **Configuration Transformation**: Complex synchronous config transformation with fallbacks for async operations
- **Error Handling**: Comprehensive error translation with user-friendly messages (L698-712)

## Critical Constraints
- **TCP Mode Required**: Adapter must run in TCP mode for proxy infrastructure compatibility (L285-297)
- **Synchronous Transform**: `transformLaunchConfig` must be synchronous despite needing async operations (L440-449)
- **Path Resolution**: ESM-safe module resolution using `import.meta.url` (L156, L248)
- **Container Compatibility**: Handles MCP_CONTAINER environment for workspace detection (L361-367)