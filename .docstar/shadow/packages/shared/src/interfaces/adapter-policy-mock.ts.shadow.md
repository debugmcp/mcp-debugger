# packages/shared/src/interfaces/adapter-policy-mock.ts
@source-hash: 2ab2e45dfe8fb394
@generated: 2026-02-10T00:41:11Z

**Purpose:** Mock adapter policy implementation for testing debug adapter behaviors. Provides simplified, test-friendly implementations of all AdapterPolicy interface methods with minimal functionality and immediate command processing.

**Core Implementation:**
- `MockAdapterPolicy` object (L11-213): Complete AdapterPolicy implementation with mock behaviors
- Configured as 'mock' type adapter with no child session support (L12-18)
- `isChildReadyEvent()` (L19-21): Uses 'initialized' event as ready signal

**Stack Frame & Variable Handling:**
- `filterStackFrames()` (L26-29): Pass-through implementation - returns all frames unfiltered
- `extractLocalVariables()` (L34-60): Simple extraction from top frame's first scope
- `getLocalScopeName()` (L65-67): Returns standard ['Local', 'Locals'] scope names

**Configuration Methods:**
- `getDapAdapterConfiguration()` (L69-73): Returns basic {type: 'mock'} config
- `resolveExecutablePath()` (L75-79): Returns provided path or 'mock' placeholder
- `getDebuggerConfiguration()` (L81-88): Minimal config with strict handshake disabled

**Command Processing:**
- `requiresCommandQueueing()` (L93): Always returns false - no queueing needed
- `shouldQueueCommand()` (L98-105): Returns immediate processing policy
- `updateStateOnCommand()` (L120-124): Tracks 'configurationDone' command
- `updateStateOnEvent()` (L129-133): Tracks 'initialized' event

**State Management:**
- `createInitialState()` (L110-115): Creates state with initialized/configurationDone flags
- `isInitialized()` (L138-140): Checks state.initialized flag
- `isConnected()` (L145-148): Uses initialized status as connection indicator

**Adapter Matching & Spawning:**
- `matchesAdapter()` (L153-160): Matches commands/args containing 'mock-adapter'
- `getAdapterSpawnConfig()` (L197-213): Returns custom command config or undefined for mock
- `getInitializationBehavior()` (L165-167): Empty object - no special requirements

**DAP Client Behavior:**
- `getDapClientBehavior()` (L172-192): Returns minimal behavior config with disabled features and 1000ms timeout

**Dependencies:**
- `@vscode/debugprotocol` for DebugProtocol types
- Local interfaces: AdapterPolicy, AdapterSpecificState, CommandHandling, DapClientBehavior
- Models: StackFrame, Variable

**Architecture:** Implements complete AdapterPolicy interface with simplified mock behaviors for testing scenarios. All complex features (child sessions, command queueing, reverse debugging) are disabled or minimally implemented.