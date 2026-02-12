# packages/adapter-javascript/src/utils/
@generated: 2026-02-11T23:47:42Z

## Overall Purpose and Responsibility

The `utils` directory provides foundational utilities for the VS Code js-debug adapter, handling cross-platform executable resolution, project configuration detection, and debugger launch coordination. These utilities abstract away filesystem operations, platform differences, and configuration parsing to support reliable JavaScript/TypeScript debugging across different environments.

## Key Components and Relationships

### Configuration Detection (`config-transformer.ts`)
- **`determineOutFiles()`**: Resolves output file patterns for source mapping
- **`isESMProject()`**: Detects ES Module projects via file extensions, package.json, and tsconfig.json
- **`hasTsConfigPaths()`**: Identifies TypeScript path mapping configurations
- **`transformConfig()`**: Main entry point for configuration processing

### Executable Resolution (`executable-resolver.ts`)
- **`findNode()`**: Core Node.js executable resolver with 4-tier fallback strategy
- **`whichInPath()`**: Cross-platform PATH-aware binary search
- **`resolveNodeExecutable()`**: Primary public API for Node.js resolution

### TypeScript Runtime Detection (`typescript-detector.ts`)
- **`detectTsRunners()`**: Detects tsx and ts-node executables with local-first strategy
- **`detectBinary()`**: Platform-aware TypeScript runtime resolution
- Integrates with executable-resolver for comprehensive binary detection

### Launch Coordination (`js-debug-launch-barrier.ts`)
- **`JsDebugLaunchBarrier`**: Implements barrier pattern for debugger readiness
- Coordinates DAP events and adapter connection status
- Provides timeout-safe launch synchronization

## Public API Surface

### Primary Entry Points
- **`transformConfig(config)`**: Main configuration transformation interface
- **`resolveNodeExecutable(preferredPath?)`**: Standard Node.js executable resolution
- **`detectTsRunners(cwd, fileSystem?)`**: TypeScript runtime detection with caching
- **`JsDebugLaunchBarrier`**: Launch coordination class implementing `AdapterLaunchBarrier`

### Configuration Utilities
- **`isESMProject(programPath, cwd, fileSystem?)`**: ESM project detection
- **`hasTsConfigPaths(cwdOrProgramDir, fileSystem?)`**: TypeScript path mapping detection
- **`determineOutFiles(programPath, userOutFiles?)`**: Output file pattern resolution

## Internal Organization and Data Flow

### Filesystem Abstraction
All utilities support dependency injection via `FileSystem` interface from `@debugmcp/shared`, enabling comprehensive testing with mock implementations. Default behavior uses `NodeFileSystem` with fallback to safe defaults on filesystem errors.

### Detection Strategy Hierarchy
1. **Local Resolution**: Project-specific binaries in `node_modules/.bin/`
2. **PATH Resolution**: System-wide executable search
3. **Configuration Files**: package.json and tsconfig.json parsing
4. **Safe Fallbacks**: Default values when detection fails

### Caching and Performance
- **Module-level caching**: TypeScript runner detection results cached globally
- **No-throw design**: All filesystem operations wrapped in try-catch with safe defaults
- **Process avoidance**: Deterministic resolution without spawning child processes

## Important Patterns and Conventions

### Platform Abstraction
- Windows vs Unix executable naming (`.exe`, `.cmd` extensions)
- PATH environment variable parsing and directory traversal
- Case-insensitive configuration matching

### Error Resilience
- All functions gracefully handle filesystem errors
- Guaranteed return values (never throw exceptions)
- Timeout-based fallbacks in launch coordination

### Testing Support
- `setDefaultFileSystem()` utilities for dependency injection
- `clearCache()` functions for test isolation
- Deterministic behavior suitable for automated testing

### Configuration Precedence
- User-provided values take precedence over detected defaults
- Multi-source detection with well-defined fallback chains
- Heuristic-based project type detection with multiple strategies

This utility collection provides the foundational layer for reliable, cross-platform JavaScript debugging support in VS Code, abstracting away the complexities of executable resolution, configuration detection, and launch coordination.