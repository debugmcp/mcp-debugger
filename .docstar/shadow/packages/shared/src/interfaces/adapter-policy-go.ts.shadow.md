# packages/shared/src/interfaces/adapter-policy-go.ts
@source-hash: 95a7e73ebf544145
@generated: 2026-02-10T00:41:13Z

## Purpose
Implements adapter policy for Go Debug Adapter (Delve/dlv) to handle Go-specific debugging behaviors, variable extraction, and DAP protocol interactions.

## Key Exports
- **GoAdapterPolicy** (L13-336): Main policy object implementing `AdapterPolicy` interface with Delve-specific configurations and behaviors

## Core Configuration (L13-24)
- **name**: 'go' - policy identifier
- **supportsReverseStartDebugging**: false - no reverse debugging support
- **childSessionStrategy**: 'none' - no child session handling
- **buildChildStartArgs** (L18-20): Throws error as child sessions unsupported

## Variable Handling (L28-84)
- **extractLocalVariables** (L28-77): Extracts local variables from top stack frame, filters Go internal variables (starting with '_'), looks for 'Locals' or 'Local' scopes
- **getLocalScopeName** (L82-84): Returns ['Locals', 'Arguments'] as Go scope names

## Executable Management (L92-142)
- **resolveExecutablePath** (L92-106): Resolves dlv executable path with priority: provided > DLV_PATH env > 'dlv' default
- **validateExecutable** (L122-142): Async validation by spawning 'dlv version' command and checking exit code/output

## Session Management (L147-202)
- **requiresCommandQueueing**: false - Go adapter processes commands immediately
- **createInitialState** (L164-169): Creates state with initialized/configurationDone flags
- **updateStateOnCommand/Event** (L174-187): Updates state based on 'configurationDone' command and 'initialized' event
- **isInitialized/isConnected** (L192-202): Both check state.initialized flag

## Adapter Recognition (L207-217)
- **matchesAdapter** (L207-217): Identifies Go adapter by checking for 'dlv', 'delve', or 'dlv dap' in command/args

## Initialization Behavior (L226-235)
- **getInitializationBehavior**: Returns deferConfigDone: false, defaultStopOnEntry: false
- Handles Delve quirk where stack traces return "unknown goroutine 1" immediately after stopping on entry

## DAP Client Behavior (L240-267)
- **getDapClientBehavior**: Minimal implementation as Go doesn't use child sessions
- **handleReverseRequest** (L243-250): Only handles 'runInTerminal' requests
- Standard timeouts and no child session features

## Stack Frame Filtering (L272-301)
- **filterStackFrames** (L272-293): Filters out Go runtime (/runtime/) and testing (/testing/) frames
- **isInternalFrame** (L298-301): Checks if frame is from runtime or testing packages

## Adapter Spawning (L306-335)
- **getAdapterSpawnConfig**: Configures dlv dap command execution
- Uses custom adapter command if provided, otherwise builds 'dlv dap --listen' command with logging options

## Dependencies
- `@vscode/debugprotocol`: DAP types
- `@debugmcp/shared`: SessionState enum
- Local interfaces: AdapterPolicy, StackFrame, Variable, DapClientBehavior
- Runtime: child_process for executable validation

## Architecture Notes
- No child session support (single-session model)
- Immediate command processing (no queueing)
- Delve-specific scope and variable naming conventions
- Built-in Go runtime frame filtering for cleaner stack traces