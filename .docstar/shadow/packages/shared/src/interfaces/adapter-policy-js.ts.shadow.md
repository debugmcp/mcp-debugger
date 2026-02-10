# packages/shared/src/interfaces/adapter-policy-js.ts
@source-hash: 919cdc5f0dd8d595
@generated: 2026-02-10T00:41:31Z

**File Purpose**: JavaScript-specific adapter policy for VS Code's js-debug (pwa-node) debugger, implementing multi-session debugging behavior while preserving generic DAP flow compatibility.

## Core Interfaces & State

**JsAdapterState** (L16-20): Extends AdapterSpecificState with JS-specific tracking:
- `initializeResponded`: Tracks completion of initialize request/response cycle
- `startSent`: Indicates if launch/attach has been sent  
- `pendingCommands`: Queue of commands awaiting proper initialization sequence

**JsDebugAdapterPolicy** (L22-728): Main policy object implementing AdapterPolicy interface with comprehensive JavaScript debugging support.

## Multi-Session Architecture

**Child Session Management** (L24-42):
- `supportsReverseStartDebugging: true`: Enables multi-session child spawning
- `childSessionStrategy: 'launchWithPendingTarget'`: Uses pending target mechanism
- `buildChildStartArgs()` (L27-37): Creates attach configuration with `__pendingTargetId` and `continueOnAttach: true`
- `isChildReadyEvent()` (L39-42): Detects child readiness via 'thread' or 'stopped' events

## Stack Frame & Variable Handling

**Frame Filtering** (L48-72):
- `isInternalFrame()` (L48-52): Identifies Node.js internals by `<node_internals>` path marker
- `filterStackFrames()` (L57-72): Removes internal frames with fallback to preserve at least one frame

**Variable Extraction** (L77-150):
- `extractLocalVariables()` (L77-149): Extracts locals from top stack frame
- Supports multiple scope patterns: 'Local', 'Local:', 'Block:', 'Script', 'Module', 'Global'
- Filters out special variables: `this`, `__proto__`, `[[...]]` internals, `$` prefixed debugger vars
- `includeSpecial` parameter controls filtering behavior

## Strict Handshake Protocol

**performHandshake()** (L192-436): Implements js-debug's required initialization sequence:
1. **Initialize** (L208-224): Sends initialize with `supportsStartDebuggingRequest: true`
2. **Wait for 'initialized'** (L227-248): 10-second timeout with event listener
3. **Set Breakpoints** (L251-285): Groups breakpoints by file, sends `setExceptionBreakpoints` and `setBreakpoints`
4. **Configuration Done** (L288-297): Sends `configurationDone`
5. **Launch/Attach** (L299-432): Handles explicit attach (port-based) vs launch flows with comprehensive config merging

## Command Queueing System

**Command Ordering Logic** (L441-524):
- `requiresCommandQueueing()`: Always returns true for JS adapter
- `shouldQueueCommand()` (L446-492): Gates commands based on initialization state:
  - Allows 'initialize' immediately
  - Queues all others until `initializeResponded`
  - Queues config commands until 'initialized' event
  - Defers launch/attach until `configurationDone`
- `processQueuedCommands()` (L497-524): Enforces strict order: configs → configurationDone → launches → others

## State Management

**State Lifecycle** (L529-590):
- `createInitialState()` (L529-536): Creates JsAdapterState with all flags false
- `updateStateOnCommand()` (L542-552): Updates flags when commands are sent
- `updateStateOnResponse()` (L557-562): Marks `initializeResponded` on initialize response
- `updateStateOnEvent()` (L567-573): Sets `initialized` flag on 'initialized' event

## DAP Client Behavior

**getDapClientBehavior()** (L624-704): Returns comprehensive DapClientBehavior configuration:
- **Reverse Request Handling** (L627-660): Processes `startDebugging` requests with `__pendingTargetId` adoption
- **Child Routing**: 14 commands routed to child sessions (threads, pause, continue, etc.)
- **Session Behaviors**: Mirrors breakpoints, defers parent configDone, requires stack trace from child
- **Timeouts**: 12-second child init timeout

## Adapter Configuration

**Spawn Configuration** (L710-728):
- `getAdapterSpawnConfig()`: Expects custom adapter command since js-debug isn't a simple executable
- Warns if no adapter command provided as js-debug requires specific VS Code extension setup

## Architecture Dependencies

- Imports DebugProtocol from '@vscode/debugprotocol'
- Integrates with core adapter-policy interfaces
- Uses SessionState enum for readiness checks
- Leverages shared models for StackFrame and Variable types
- Coordinates with DapClientBehavior for multi-session orchestration

## Critical Invariants

1. **Initialization Order**: initialize → initialized event → configs → configurationDone → launch/attach
2. **Multi-session**: Parent handles breakpoints/config, child handles execution commands  
3. **Frame Safety**: Always preserves at least one stack frame even when filtering internals
4. **Command Gating**: Strict state-based command queueing prevents DAP protocol violations