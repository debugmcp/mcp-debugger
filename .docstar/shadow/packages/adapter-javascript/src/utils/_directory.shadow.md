# packages/adapter-javascript/src/utils/
@generated: 2026-02-10T01:19:38Z

## Overall Purpose
The `utils` directory provides core infrastructure utilities for the JavaScript debug adapter, focusing on environment detection, configuration analysis, and runtime coordination. These utilities enable the adapter to intelligently configure debugging sessions based on project characteristics and system capabilities.

## Key Components and Relationships

### Configuration Analysis (`config-transformer.ts`)
- **Purpose**: Analyzes project structure to determine ESM/CommonJS module type, TypeScript paths configuration, and output file patterns
- **Key API**: `transformConfig()`, `isESMProject()`, `hasTsConfigPaths()`, `determineOutFiles()`
- **Pattern**: Heuristic-based detection using multiple fallback strategies (file extensions → package.json → tsconfig.json)

### Executable Resolution (`executable-resolver.ts` & `typescript-detector.ts`)
- **Node.js Resolution**: `findNode()` provides deterministic Node.js executable discovery across platforms
- **TypeScript Runtime Detection**: `detectTsRunners()` locates tsx/ts-node with local-first strategy
- **Pattern**: Platform-aware resolution with PATH search and graceful fallbacks

### Launch Coordination (`js-debug-launch-barrier.ts`)
- **Purpose**: Synchronizes debugger launch readiness using barrier pattern
- **Integration**: Waits for DAP 'stopped' events or adapter connection status
- **Pattern**: Promise-based coordination with timeout fallback and proper cleanup

## Public API Surface

### Main Entry Points
- `transformConfig(config)` - Primary configuration transformation
- `findNode(preferredPath?, fileSystem?)` - Cross-platform Node.js resolution  
- `detectTsRunners(cwd, fileSystem?)` - TypeScript runtime detection with caching
- `JsDebugLaunchBarrier` class - Launch synchronization barrier

### Testing Support
- `setDefaultFileSystem(fileSystem)` - Available in all modules for test dependency injection
- `clearCache()` - Cache reset for typescript-detector testing

## Internal Organization and Data Flow

### Dependency Flow
```
config-transformer → project analysis → debugging configuration
executable-resolver → platform detection → runtime path resolution
typescript-detector → local-first search → cached executable paths
js-debug-launch-barrier → event coordination → launch synchronization
```

### Shared Patterns
- **No-throw Design**: All functions use safe fallbacks rather than throwing exceptions
- **Dependency Injection**: FileSystem abstraction enables testing across all modules
- **Platform Abstraction**: Windows vs Unix handling built into resolution logic
- **Caching Strategy**: Module-level caching for expensive filesystem operations

## Important Conventions

### Error Handling
- Filesystem operations wrapped in try-catch blocks
- Graceful degradation with sensible defaults
- No process spawning for deterministic cross-platform behavior

### Path Resolution
- Always return absolute paths via `path.resolve()`
- Respect PATH environment variable ordering
- Local node_modules/.bin precedence over global PATH

### Configuration Detection Precedence
1. User-provided explicit configuration
2. File extension analysis (.mjs, .mts)
3. package.json "type" field
4. tsconfig.json module settings
5. Safe defaults as final fallback

This utility suite provides the foundational detection and coordination capabilities that enable the JavaScript debug adapter to intelligently adapt to diverse project configurations and runtime environments.