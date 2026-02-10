# packages/shared/src/interfaces/adapter-policy-java.ts
@source-hash: 0f95edac904989b6
@generated: 2026-02-10T00:41:12Z

## Java Debug Adapter Policy Implementation

**Primary Purpose**: Implements adapter-specific behaviors and configurations for the Java Debug Adapter (jdb), providing Java-specific variable handling, session management, and debug protocol interactions.

### Core Configuration (L12-22)
- `JavaAdapterPolicy` constant exports the complete policy object
- Disables reverse debugging support and child sessions
- Uses 'java' as adapter type identifier
- Configured for immediate command processing without queueing

### Variable Extraction Logic (L27-73)
- `extractLocalVariables()` - Extracts local variables from Java debug sessions
- Targets "Local" or "Locals" scope specifically for Java runtime
- Filters out `this` reference unless `includeSpecial` flag is set
- Operates on top stack frame only for current execution context

### Java Runtime Integration (L88-133)
- `resolveExecutablePath()` (L88-103) - Resolves Java executable with fallback chain: provided path → JAVA_HOME/bin/java → system 'java'
- `validateExecutable()` (L119-133) - Asynchronously validates Java command by spawning `java -version`
- Cross-platform executable name handling (java.exe on Windows)

### Session State Management (L155-194)
- `createInitialState()` (L155-160) - Creates state with `initialized` and `configurationDone` flags
- State update methods track initialization and configuration completion
- `isSessionReady()` (L114) - Session ready when in PAUSED state
- Connection status tied directly to initialization state

### Command Processing (L138-150)
- No command queueing required for Java adapter
- `shouldQueueCommand()` returns immediate processing directive
- Commands processed synchronously without deferral

### Adapter Detection (L198-204)
- `matchesAdapter()` identifies Java adapters by checking for 'jdb-dap-server' or 'jdb' in command arguments
- Case-insensitive string matching on joined arguments

### DAP Client Behavior (L216-243)
- Minimal reverse request handling (Java doesn't use child sessions)
- Handles `runInTerminal` requests with empty acknowledgment
- No breakpoint mirroring or child session routing
- Standard 5-second child initialization timeout

### Adapter Spawning (L248-263)
- `getAdapterSpawnConfig()` processes spawn configuration
- Requires `adapterCommand` to be provided in payload
- Passes through command, arguments, host, port, and environment configuration

### Dependencies
- `@vscode/debugprotocol` for Debug Adapter Protocol types
- `@debugmcp/shared` for SessionState enum
- Local interfaces for adapter policy contracts and model types
- Node.js `child_process` for executable validation (dynamically imported)