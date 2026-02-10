# packages/shared/src/interfaces/adapter-policy.ts
@source-hash: cad2c41773f4519a
@generated: 2026-02-10T00:41:20Z

## Purpose
Defines the `AdapterPolicy` interface and related types for managing Debug Adapter Protocol (DAP) behavior across different language adapters. Provides a pluggable policy system to handle adapter-specific quirks, multi-session strategies, and initialization behaviors while keeping the DAP transport core generic.

## Key Types & Interfaces

### `ChildSessionStrategy` (L21-25)
Union type defining strategies for creating child debug sessions:
- `'none'` - No child session creation
- `'launchWithPendingTarget'` - Launch using `__pendingTargetId` (js-debug style)
- `'attachByPort'` - Attach via inspector port
- `'adoptInParent'` - Adopt target in same parent session

### `CommandHandling` (L30-34)
Result type for command processing decisions with `shouldQueue`, `shouldDefer` flags and optional reason.

### `AdapterSpecificState` (L39-43)
Extensible state interface tracking adapter initialization status with `initialized` and `configurationDone` booleans plus custom properties.

### `AdapterPolicy` (L45-319)
Core interface defining adapter behavior contract with key methods:

**Session Management:**
- `supportsReverseStartDebugging` (L54) - Whether adapter initiates child sessions
- `childSessionStrategy` (L59) - Strategy for child session creation
- `buildChildStartArgs()` (L72-75) - Constructs child session launch/attach args
- `isChildReadyEvent()` (L82) - Determines when child session is ready

**Command & State Management:**
- `requiresCommandQueueing()` (L200) - Whether commands need queuing before init
- `shouldQueueCommand()` (L208) - Per-command queueing decisions
- `createInitialState()` (L225) - Factory for adapter state
- State update methods for commands (L233), responses (L241), events (L249)
- `isInitialized()` (L256) and `isConnected()` (L263) - State checks

**Language-Specific Features:**
- `filterStackFrames()` (L92) - Optional frame filtering for internal/framework code
- `extractLocalVariables()` (L113-118) - Language-specific variable extraction
- `getLocalScopeName()` (L126) - Scope name patterns for locals
- `resolveExecutablePath()` (L146) - Executable resolution logic
- `validateExecutable()` (L177) - Optional executable validation

**Adapter Configuration:**
- `getDapAdapterConfiguration()` (L134-137) - DAP adapter type and config
- `getDebuggerConfiguration()` (L154-159) - Debugger behavior flags
- `getInitializationBehavior()` (L277-288) - Init behavior flags
- `getDapClientBehavior()` (L295) - Client behavior configuration
- `getAdapterSpawnConfig()` (L303-318) - Optional spawn configuration

**Handshake & Lifecycle:**
- `performHandshake()` (L186-194) - Optional post-connection initialization
- `isSessionReady()` (L165-168) - Custom session readiness logic
- `matchesAdapter()` (L270) - Adapter command matching

## Default Implementation

### `DefaultAdapterPolicy` (L327-358)
Minimal placeholder implementation used during adapter policy selection. Provides safe defaults and throws errors for unsupported operations like child session creation (L332-336). All behavioral flags return false/empty to prevent accidental reliance.

## Dependencies
- `@vscode/debugprotocol` - DAP types
- `../models/index.js` - StackFrame, Variable models
- `./dap-client-behavior.js` - Client behavior types
- `@debugmcp/shared` - SessionState
- `./debug-adapter.js` - Language-specific launch config

## Architecture Notes
Policy pattern enables adapter-specific behaviors without polluting core DAP transport. Each language adapter (js-debug, debugpy, etc.) implements this interface to define its unique requirements for session management, command handling, and initialization sequences.