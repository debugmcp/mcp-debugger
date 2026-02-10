# packages/shared/src/interfaces/adapter-policy-java.ts
@source-hash: 0f95edac904989b6
@generated: 2026-02-09T18:14:11Z

## Purpose
Implements a Java Debug Adapter (jdb) policy for the Debug Adapter Protocol (DAP), providing Java-specific debugging behaviors and configurations.

## Core Components

### JavaAdapterPolicy Object (L12-264)
Main policy implementation with adapter-specific configurations:
- **name**: 'java' (L13)
- **supportsReverseStartDebugging**: false (L14) 
- **childSessionStrategy**: 'none' (L15)

### Variable Extraction (L27-73)
**extractLocalVariables()**: Extracts local variables from Java debug frames
- Targets top stack frame (L38)
- Searches for 'Local' or 'Locals' scopes (L46-48)
- Filters out 'this' variable unless explicitly requested (L58-70)

### Configuration Methods
- **getLocalScopeName()** (L78-80): Returns ['Local', 'Locals'] scope names
- **getDapAdapterConfiguration()** (L82-86): Returns {type: 'java'} config
- **getDebuggerConfiguration()** (L105-112): Java debugger settings including variable type support

### Executable Resolution (L88-103)
**resolveExecutablePath()**: Resolves Java executable path with priority:
1. Provided path
2. JAVA_HOME/bin/java (with Windows .exe handling)
3. Default 'java' command

### Validation (L119-133)
**validateExecutable()**: Validates Java executable by spawning `java -version`
- Uses dynamic import for child_process (L121)
- Returns Promise<boolean> based on exit code

### State Management (L155-193)
- **createInitialState()** (L155-160): Creates {initialized: false, configurationDone: false}
- **updateStateOnCommand()** (L165-169): Updates state on 'configurationDone'
- **updateStateOnEvent()** (L174-178): Updates state on 'initialized' event
- **isInitialized()** & **isConnected()** (L183-193): State checking methods

### Command Handling (L138-150)
- **requiresCommandQueueing()**: Returns false (L138)
- **shouldQueueCommand()**: Returns immediate processing config (L143-150)

### Adapter Matching (L198-204)
**matchesAdapter()**: Identifies Java adapter by checking for 'jdb-dap-server' or 'jdb' in arguments

### DAP Client Behavior (L216-243)
**getDapClientBehavior()**: Returns minimal DAP client configuration
- Handles 'runInTerminal' reverse requests (L219-226)
- Disables child session features (L232-234)
- Sets standard timeouts (L240)

### Spawn Configuration (L248-263)
**getAdapterSpawnConfig()**: Configures Java debug adapter spawning
- Uses provided adapterCommand directly (L250-258)
- Throws error if no adapterCommand provided (L262)

## Dependencies
- @vscode/debugprotocol: DAP types
- ./adapter-policy.js: Base policy interface
- @debugmcp/shared: SessionState enum
- ../models/index.js: StackFrame, Variable types
- ./dap-client-behavior.js: DAP client interfaces

## Key Characteristics
- No child session support (throws errors for child session methods)
- Immediate command processing (no queueing)
- Platform-aware Java executable resolution
- Minimal DAP client behavior (no reverse debugging features)
- State tracking for initialization and configuration phases