# packages/adapter-javascript/src/javascript-debug-adapter.ts
@source-hash: e92d8d2d9baf2dce
@generated: 2026-02-10T01:19:19Z

## JavascriptDebugAdapter

Primary JavaScript/TypeScript debug adapter implementation that wraps the vendored VS Code js-debug adapter in a standardized interface for the DebugMCP framework.

### Core Architecture

**JavascriptDebugAdapter class (L35-810)** extends EventEmitter and implements IDebugAdapter
- Language: 'javascript' (cast to DebugLanguage due to type limitations)
- Manages state transitions through AdapterState enum
- Provides TCP-only transport mode for proxy infrastructure
- Handles both JavaScript and TypeScript debugging with automatic runtime detection

### Key Components

**State Management (L40-44, L117-144)**
- `state`: Current adapter state (UNINITIALIZED → INITIALIZING → READY → CONNECTED → DEBUGGING)
- `connected`: Connection status flag
- `currentThreadId`: Active debugging thread tracking
- `transitionTo()` (L140-144): State transition with event emission

**Caching Layer (L46-48)**
- `cachedNodePath`: Memoized Node.js executable path
- `cachedTsRunners`: Cached TypeScript runtime detection results

**Lifecycle Methods**
- `initialize()` (L57-92): Environment validation, dependency checking, state transition
- `dispose()` (L94-113): Cleanup runtime state, clear caches, emit lifecycle events
- `validateEnvironment()` (L148-199): Checks for vendored js-debug adapter availability

**Executable Resolution (L213-241)**
- `resolveExecutablePath()` (L214-231): Node.js path resolution with caching
- `getExecutableSearchPaths()` (L237-240): PATH-based search locations

**Adapter Command Building (L244-331)**
- `buildAdapterCommand()`: Constructs Node.js command to launch vendored js-debug
- Searches multiple possible paths for vsDebugServer.cjs/js
- Validates TCP port requirement (proxy infrastructure constraint)
- Sets NODE_OPTIONS with memory limits

**Launch Configuration Transform (L343-553)**
- `transformLaunchConfig()`: Converts generic config to js-debug specific format
- Automatic TypeScript detection via file extensions (.ts, .tsx, .mts, .cts)
- Runtime selection priority: user override → tsx → ts-node → node
- Synchronous execution with fallbacks (cannot use async in interface)
- ESM project detection and loader configuration
- Source map and outFiles handling
- Node inspector flag normalization

**Configuration Utilities (L555-798)**
- `normalizeBinary()` (L555-564): Path normalization for cross-platform compatibility
- `isNodeRuntime()` (L566-570): Runtime type detection
- `normalizeAndDedupeArgs()` (L763-791): Argument deduplication for -r and --loader flags
- `hasPairArgs()` (L793-798): Flag-value pair detection

**DAP Protocol Handling (L583-657)**
- `sendDapRequest()` (L583-612): Request preprocessing with path resolution
- `handleDapEvent()` (L614-652): Event processing for state management and thread tracking
- Automatic output event category assignment
- Thread ID extraction from 'stopped' events

**Connection Management (L660-678)**
- `connect()` (L660-666): Mock connection with state transition
- `disconnect()` (L668-674): Connection cleanup
- Transport handled by external ProxyManager

**Feature Support (L714-761)**
- Comprehensive DAP feature support including conditional breakpoints, log points, exception handling
- Exception breakpoint filters for uncaught and user-unhandled exceptions
- Conservative capability reporting

### Dependencies

**External Imports**
- `@vscode/debugprotocol`: DAP type definitions
- `@debugmcp/shared`: Core framework types and enums
- Local utilities: executable-resolver, typescript-detector, config-transformer, launch-barrier

**Key Utilities**
- `findNode()` (L30): Node.js executable discovery
- `detectTsRunnersUtil()` (L31): TypeScript runtime detection
- `determineOutFiles()`, `isESMProject()`, `hasTsConfigPaths()` (L32): Configuration analysis
- `JsDebugLaunchBarrier` (L33): Launch coordination

### Critical Constraints

1. **TCP Transport Only**: Adapter port validation required for proxy infrastructure
2. **Synchronous Config Transform**: Interface limitation prevents async detection in transformLaunchConfig
3. **Vendored js-debug Dependency**: Must find vsDebugServer.cjs in specific paths
4. **Container Mode Support**: Handles MCP_CONTAINER and MCP_WORKSPACE_ROOT environment variables
5. **TypeScript Auto-Detection**: Automatic runtime and loader selection based on file extensions and project configuration

### Error Handling

**Error Translation (L696-710)**
- Maps common Node.js errors (ENOENT, EACCES) to user-friendly messages
- TypeScript module detection for missing dependency guidance
- Installation instructions with specific commands