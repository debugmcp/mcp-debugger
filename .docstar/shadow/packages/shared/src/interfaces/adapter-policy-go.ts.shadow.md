# packages/shared/src/interfaces/adapter-policy-go.ts
@source-hash: 5f42366b5ead9db2
@generated: 2026-02-09T18:14:11Z

## Purpose
Implements adapter-specific debugging policy for Go using Delve (dlv) debugger. Provides Delve-specific behaviors for variable handling, scope resolution, executable validation, and DAP (Debug Adapter Protocol) communication through `dlv dap --listen=:port` mode.

## Core Implementation
- **GoAdapterPolicy** (L13-331): Main policy object implementing AdapterPolicy interface for Delve debugger
- **extractLocalVariables** (L28-77): Extracts local variables from top stack frame, filtering out Go internal variables (underscore-prefixed) and finding "Locals"/"Arguments" scopes
- **validateExecutable** (L122-142): Asynchronously validates dlv executable by spawning `dlv version` and checking exit code + output
- **getAdapterSpawnConfig** (L302-331): Builds dlv DAP command with listen address, logging configuration, and custom adapter command support

## Key Configuration Methods
- **resolveExecutablePath** (L92-106): Resolves dlv path with precedence: provided > DLV_PATH env > "dlv" default
- **getLocalScopeName** (L82-84): Returns Go-specific scope names ["Locals", "Arguments"]
- **getDapAdapterConfiguration** (L86-90): Returns type "dlv-dap"
- **getDebuggerConfiguration** (L108-115): Sets requiresStrictHandshake=false, supportsVariableType=true

## State Management
- **createInitialState** (L164-169): Creates state with initialized=false, configurationDone=false
- **updateStateOnCommand/Event** (L174-187): Tracks "configurationDone" commands and "initialized" events
- **isInitialized/isConnected** (L192-202): Both check state.initialized flag

## Frame and Variable Filtering
- **filterStackFrames** (L268-289): Removes Go runtime (/runtime/) and testing (/testing/) frames unless includeInternals=true
- **isInternalFrame** (L294-297): Identifies internal frames by file path patterns

## Adapter Matching and Behaviors
- **matchesAdapter** (L207-217): Matches commands containing "dlv", "delve", or "dlv dap" in command/args
- **getDapClientBehavior** (L236-263): Returns minimal DAP behavior with no child session support, handleReverseRequest for runInTerminal
- **childSessionStrategy** (L16): Set to "none" - Go doesn't support child debugging sessions

## Dependencies
- Imports from @vscode/debugprotocol, adapter-policy interfaces, SessionState, and model types (L7-11)
- Dynamic import of child_process.spawn for executable validation (L124)

## Key Constraints
- No reverse debugging support (supportsReverseStartDebugging=false, L15)  
- No command queueing required (requiresCommandQueueing=false, L147)
- Child sessions throw error if attempted (L18-20)
- Note about Delve "unknown goroutine 1" quirk in comments (L222-224)