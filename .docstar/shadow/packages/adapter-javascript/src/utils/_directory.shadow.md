# packages\adapter-javascript\src\utils/
@generated: 2026-02-12T21:05:45Z

## Overall Purpose
The `utils` directory provides core debugging infrastructure utilities for the VS Code js-debug adapter, focusing on environment detection, configuration transformation, and launch coordination. It serves as the foundation layer that enables the adapter to make intelligent decisions about TypeScript/ESM projects, locate runtime executables, and coordinate debugging session initialization across different JavaScript environments.

## Key Components and Integration

### Configuration Analysis (`config-transformer.ts`)
- **`isESMProject()`**: Multi-heuristic ESM detection via file extensions, package.json, and tsconfig.json
- **`determineOutFiles()`**: Source map output file resolution with sensible defaults
- **`hasTsConfigPaths()`**: TypeScript path mapping detection for module resolution
- **`transformConfig()`**: Configuration normalization entry point

### Runtime Discovery (`typescript-detector.ts` + `executable-resolver.ts`)
- **`detectTsRunners()`**: Finds tsx/ts-node with local-first resolution and caching
- **`findNode()`**: Cross-platform Node.js executable location with 4-tier precedence
- **`whichInPath()`**: PATH-aware binary search respecting directory precedence

### Launch Coordination (`js-debug-launch-barrier.ts`)
- **`JsDebugLaunchBarrier`**: Promise-based synchronization waiting for DAP 'stopped' events or adapter connection
- Implements timeout fallback to prevent blocking on failed launches

## Public API Surface

### Primary Entry Points
- **`transformConfig(config)`**: Main configuration transformation pipeline
- **`detectTsRunners(cwd?, fileSystem?)`**: TypeScript runtime detection with caching
- **`resolveNodeExecutable(preferredPath?)`**: Node.js executable resolution
- **`JsDebugLaunchBarrier`**: Launch coordination barrier implementation

### Testing Utilities
- **`setDefaultFileSystem()`**: Dependency injection for filesystem mocking
- **`clearCache()`**: TypeScript detection cache management

## Internal Organization and Data Flow

**Configuration Flow**: Project directory → package.json/tsconfig.json analysis → ESM/TypeScript feature detection → configuration defaults

**Runtime Resolution Flow**: Current working directory → local node_modules/.bin → PATH search → fallback to process.execPath

**Launch Coordination Flow**: Launch request → barrier setup → DAP event monitoring → timeout management → resolution/cleanup

## Architectural Patterns

### Cross-Cutting Concerns
- **No-Throw Design**: All utilities use safe filesystem operations with graceful degradation
- **Dependency Injection**: FileSystem abstraction enables comprehensive testing
- **Platform Abstraction**: Windows/POSIX differences handled transparently
- **Performance Optimization**: Module-level caching for expensive detection operations

### Error Resilience
- Filesystem errors ignored with safe defaults
- Timeout mechanisms prevent hanging operations
- Multiple fallback strategies for executable resolution
- Defensive programming with settled flags and cleanup

### Integration Points
The utilities work cohesively to support the adapter's core mission: analyzing JavaScript/TypeScript project characteristics, locating appropriate runtime executables, and coordinating launch sequences. The configuration transformer informs runtime selection, the executable resolver provides the actual binaries, and the launch barrier ensures proper initialization timing.