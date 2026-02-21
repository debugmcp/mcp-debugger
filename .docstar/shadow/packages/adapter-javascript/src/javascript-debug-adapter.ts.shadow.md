# packages\adapter-javascript\src\javascript-debug-adapter.ts
@source-hash: bf389ee512ea16e2
@generated: 2026-02-21T08:28:28Z

## Primary Purpose
JavaScript/TypeScript Debug Adapter implementation that integrates with the VS Code Debug Adapter Protocol (DAP) through the debugmcp framework. This adapter wraps Microsoft's js-debug adapter and provides JavaScript/TypeScript-specific debugging capabilities including TypeScript compilation, runtime detection, and configuration transformation.

## Key Classes & Functions

### JavascriptDebugAdapter (L35-806)
Main adapter class extending EventEmitter and implementing IDebugAdapter interface. Manages the complete lifecycle of JavaScript/TypeScript debugging sessions.

**Core State Management:**
- `getState()` (L116): Returns current adapter state (UNINITIALIZED, READY, CONNECTED, etc.)
- `isReady()` (L120): Checks if adapter is in operational state
- `transitionTo()` (L139): Internal state transition with event emission
- `initialize()` (L56): Validates environment and transitions to READY state
- `dispose()` (L93): Cleanup method clearing caches and emitting lifecycle events

**Environment Validation:**
- `validateEnvironment()` (L147): Checks for js-debug adapter availability at multiple possible paths
- `getRequiredDependencies()` (L200): Returns Node.js dependency information
- `resolveExecutablePath()` (L213): Finds and caches Node.js executable with memoization

**Adapter Command Building:**
- `buildAdapterCommand()` (L243): Constructs command to launch js-debug adapter in TCP mode
- `getAdapterModuleName()` (L332): Returns 'js-debug' identifier
- Searches multiple paths for vendored js-debug including container-specific locations

**Launch Configuration Transformation:**
- `transformLaunchConfig()` (L342): Converts generic config to js-debug-specific configuration
- Handles TypeScript detection via file extensions (.ts, .tsx, .mts, .cts)
- Manages runtime executable selection (node, tsx, ts-node)
- Configures source maps, outFiles, and skip patterns
- Processes environment variables and runtime arguments

**DAP Protocol Handling:**
- `sendDapRequest()` (L580): Stub for DAP requests (transport handled by ProxyManager)
- `handleDapEvent()` (L611): Processes DAP events including 'stopped', 'output', 'terminated'
- `handleDapResponse()` (L651): No-op response handler
- Updates internal state based on debugging events

**Connection Management:**
- `connect()` (L657): Establishes connection state and emits events
- `disconnect()` (L665): Cleans up connection state
- `isConnected()` (L673): Returns connection status

**Feature Support:**
- `supportsFeature()` (L711): Declares support for conditional breakpoints, function breakpoints, etc.
- `getCapabilities()` (L742): Returns comprehensive DAP capabilities including exception filters
- `getFeatureRequirements()` (L727): Provides requirements for specific features

## Key Dependencies & Relationships

**External Dependencies:**
- `@vscode/debugprotocol`: DAP protocol types
- `@debugmcp/shared`: Core adapter interfaces and types
- Node.js built-ins: events, path, fs, url

**Internal Utilities:**
- `./utils/executable-resolver.js`: findNode() for Node.js discovery
- `./utils/typescript-detector.js`: TypeScript runner detection (tsx, ts-node)
- `./utils/config-transformer.js`: Configuration analysis (outFiles, ESM detection, tsconfig paths)
- `./utils/js-debug-launch-barrier.js`: Launch synchronization

**Key Interfaces Implemented:**
- `IDebugAdapter`: Core adapter contract
- `EventEmitter`: Event-driven architecture for state changes

## Notable Patterns & Architectural Decisions

**Memoization Strategy:**
- Caches Node.js executable path (`cachedNodePath`) and TypeScript runners (`cachedTsRunners`) per instance
- Provides deterministic behavior with explicit cache invalidation in dispose()

**Synchronous Configuration Transform:**
- `transformLaunchConfig()` must be synchronous per interface contract
- Uses `detectBinary()` for synchronous file system checks instead of async alternatives
- Balances comprehensive configuration with interface constraints

**Multi-Path Vendoring:**
- Searches multiple locations for js-debug adapter to support different deployment scenarios
- Handles development, container, and bundled distributions

**Runtime Detection Hierarchy:**
- Prioritizes user overrides → tsx detection → ts-node detection → Node.js fallback
- Normalizes binary paths for cross-platform compatibility

**Idempotent Argument Processing:**
- `normalizeAndDedupeArgs()` (L760): Prevents duplicate runtime arguments
- `hasPairArgs()` (L790): Checks for existing flag-value pairs before addition

## Critical Invariants & Constraints

- TCP mode is required by proxy infrastructure (validates non-zero adapterPort)
- js-debug must be vendored and accessible before adapter can function
- TypeScript detection based purely on file extensions
- State transitions must emit appropriate events for consumer synchronization
- Environment validation must be recoverable to allow retry scenarios
- All path operations must be cross-platform compatible

## Private Helper Methods

**Runtime Analysis:**
- `normalizeBinary()` (L552): Cross-platform path normalization
- `isNodeRuntime()` (L563): Identifies Node.js executables by basename
- `detectTypeScriptRunners()` (L799): Async TypeScript runner discovery with caching

**Error Translation:**
- `translateErrorMessage()` (L693): Converts technical errors to user-friendly messages
- `getMissingExecutableError()` (L689): Standard Node.js installation guidance