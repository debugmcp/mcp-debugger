# packages\adapter-javascript\src\utils/
@generated: 2026-02-12T21:00:56Z

## Overall Purpose

This utilities module provides configuration detection, process resolution, and launch coordination infrastructure for the JavaScript/TypeScript debugging adapter. It serves as a foundational layer that handles cross-platform executable discovery, project configuration analysis, and debugger synchronization patterns.

## Key Components and Relationships

### Configuration Analysis (`config-transformer.ts`)
- **Primary Role**: Analyzes project structure to determine build outputs, module type (ESM/CommonJS), and TypeScript path mapping
- **Key Functions**: `isESMProject()`, `hasTsConfigPaths()`, `determineOutFiles()`
- **Data Sources**: package.json, tsconfig.json, file extensions
- **Integration**: Feeds configuration data to debugger launch processes

### Executable Resolution (`executable-resolver.ts`)
- **Primary Role**: Cross-platform Node.js executable discovery with PATH-aware search
- **Key Functions**: `findNode()`, `whichInPath()`, `resolveNodeExecutable()`
- **Strategy**: 4-tier precedence (preferred → process.execPath → PATH → fallback)
- **Integration**: Consumed by TypeScript detector and debugger launch processes

### TypeScript Runtime Detection (`typescript-detector.ts`)
- **Primary Role**: Discovers local and global tsx/ts-node executables for TypeScript debugging
- **Key Functions**: `detectTsRunners()`, `detectBinary()`
- **Strategy**: Local node_modules first, then PATH fallback with caching
- **Dependencies**: Uses `executable-resolver` utilities for platform-aware binary resolution

### Launch Coordination (`js-debug-launch-barrier.ts`)
- **Primary Role**: Synchronizes debugger startup by waiting for DAP events or adapter connection
- **Key Class**: `JsDebugLaunchBarrier` implementing barrier pattern
- **Integration**: Orchestrates timing between debugger launch and readiness detection

## Public API Surface

### Primary Entry Points
- **`transformConfig(config)`**: Main configuration transformation (delegates to detection utilities)
- **`resolveNodeExecutable(preferredPath?)`**: Simplified Node.js executable resolution
- **`detectTsRunners(cwd?, fileSystem?)`**: TypeScript runtime discovery with caching
- **`JsDebugLaunchBarrier`**: Debugger launch coordination class

### Configuration Detection
- **`isESMProject()`**: ESM vs CommonJS module detection
- **`hasTsConfigPaths()`**: TypeScript path mapping detection
- **`determineOutFiles()`**: Build output pattern resolution

## Internal Organization and Data Flow

### Layered Architecture
1. **Base Layer**: Filesystem abstraction and platform detection
2. **Detection Layer**: Configuration analysis and executable resolution
3. **Coordination Layer**: Launch barrier and timing control

### Data Flow Patterns
1. **Configuration Flow**: File analysis → project characteristics → debugger configuration
2. **Executable Flow**: Platform detection → PATH search → absolute path resolution
3. **Launch Flow**: Request dispatch → event monitoring → barrier resolution

## Important Patterns and Conventions

### Design Principles
- **No-Throw Safety**: All filesystem operations wrapped in try-catch with safe defaults
- **Dependency Injection**: FileSystem abstraction enables testing with mock implementations
- **Caching Strategy**: Module-level caching for expensive detection operations
- **Platform Abstraction**: Windows/Unix executable naming and path handling

### Error Handling
- **Graceful Degradation**: Functions return safe defaults rather than throwing
- **Defensive Programming**: Guards against double resolution and resource leaks
- **Timeout Fallbacks**: Launch barriers proceed with warnings rather than blocking indefinitely

### Testing Support
- **`setDefaultFileSystem()`**: Injectable filesystem for unit testing
- **`clearCache()`**: Cache reset utilities for test isolation
- **Deterministic Behavior**: No process spawning, predictable fallback chains