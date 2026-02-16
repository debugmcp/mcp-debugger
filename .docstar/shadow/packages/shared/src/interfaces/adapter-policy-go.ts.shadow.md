# packages\shared\src\interfaces\adapter-policy-go.ts
@source-hash: 0211ecc8e3d0bcbe
@generated: 2026-02-16T08:23:59Z

## Go Debug Adapter Policy (Delve/dlv)

**Primary Responsibility**: Implements Delve-specific debugging behaviors and variable handling logic for the Go Debug Adapter Protocol (DAP) integration.

### Core Implementation
- **GoAdapterPolicy** (L13-339): Main policy object implementing the `AdapterPolicy` interface with Delve-specific configurations
- **Adapter Type**: `dlv-dap` for Delve DAP adapter integration (L88)
- **Child Sessions**: Explicitly disabled - throws error for child session attempts (L18-20)

### Key Variable Handling
- **extractLocalVariables()** (L28-77): Extracts local variables from the top stack frame, filtering out Go internal variables (those starting with `_`) unless `includeSpecial` is true
- **getLocalScopeName()** (L82-84): Returns `['Locals', 'Arguments']` scope names used by Delve
- **Variable Filtering**: Excludes underscore-prefixed variables and function closure variables by default

### Executable Management  
- **resolveExecutablePath()** (L92-106): Path resolution priority: provided path → `DLV_PATH` env var → default `dlv` command
- **validateExecutable()** (L122-142): Async validation by spawning `dlv version` command and checking for successful exit with output

### Session State Management
- **createInitialState()** (L164-169): Creates state with `initialized: false, configurationDone: false`
- **State Updates**: Tracks initialization via `initialized` event (L183-187) and configuration via `configurationDone` command (L174-178)
- **isSessionReady()** (L117): Session ready when state is `PAUSED`

### Adapter Matching & Configuration
- **matchesAdapter()** (L207-217): Identifies Go adapter by checking for 'dlv', 'delve', or 'dlv dap' in command/args
- **getAdapterSpawnConfig()** (L309-338): Builds spawn configuration for `dlv dap --listen=:port` with logging options

### Delve-Specific Behaviors
- **Initialization Quirks** (L226-238): 
  - `defaultStopOnEntry: false` - avoids "unknown goroutine 1" issue when requesting stack traces immediately after entry
  - `sendLaunchBeforeConfig: true` - handles Delve's early 'initialized' event timing
- **No Command Queueing**: Commands processed immediately (L147, L152-159)
- **Stack Frame Filtering** (L275-296): Removes Go runtime (`/runtime/`) and testing (`/testing/`) frames unless `includeInternals` is true

### DAP Client Integration
- **getDapClientBehavior()** (L243-270): Minimal DAP client behavior since Go doesn't use child sessions
- **Reverse Requests**: Basic handling for `runInTerminal` commands (L246-253)
- **No Child Session Features**: All child session flags disabled

### Dependencies
- `@vscode/debugprotocol` for DAP types
- `@debugmcp/shared` for SessionState enum  
- Local models for StackFrame, Variable types
- Dynamic `child_process` import for executable validation