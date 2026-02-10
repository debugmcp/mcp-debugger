# packages/adapter-javascript/src/utils/
@generated: 2026-02-10T21:26:20Z

## Overall Purpose and Responsibility

The `packages/adapter-javascript/src/utils` directory provides essential utility modules for JavaScript/TypeScript debugging support in VS Code's js-debug adapter. This module handles environment detection, configuration transformation, executable resolution, and launch coordination - all critical foundational components that enable the debugger to work correctly across different project setups and platforms.

## Key Components and Relationships

### Configuration Detection and Transformation
- **config-transformer.ts**: Analyzes project structure to detect ESM projects, TypeScript path mappings, and output file patterns. Uses filesystem-safe, no-throw operations to determine project characteristics.
- **typescript-detector.ts**: Locates TypeScript runtime executables (tsx, ts-node) with local-first resolution strategy and performance caching.

### Executable Resolution
- **executable-resolver.ts**: Cross-platform Node.js executable path resolution using deterministic 4-tier precedence (preferred → execPath → PATH → fallback). Provides platform-aware binary search without process spawning.

### Launch Coordination
- **js-debug-launch-barrier.ts**: Implements barrier pattern to coordinate debugger launch readiness, waiting for DAP 'stopped' events or adapter connection with timeout fallback.

## Public API Surface

### Main Entry Points
- `determineOutFiles(programPath, userOutFiles)` - Resolves JavaScript output file patterns
- `isESMProject(programPath, cwd, fileSystem)` - Detects ES Module projects via multiple heuristics
- `hasTsConfigPaths(cwdOrProgramDir, fileSystem)` - Checks for TypeScript path mapping configuration
- `findNode(preferredPath?, fileSystem?)` - Resolves Node.js executable across platforms
- `detectTsRunners(cwd, fileSystem?)` - Locates TypeScript runtime executables with caching
- `JsDebugLaunchBarrier` class - Coordinates debugger launch timing

### Testing Support
- `setDefaultFileSystem()` functions in multiple modules enable dependency injection for testing
- `clearCache()` in typescript-detector for test isolation

## Internal Organization and Data Flow

### Layered Architecture
1. **Detection Layer**: Configuration and executable detection with fallback strategies
2. **Resolution Layer**: Path resolution with platform-specific handling
3. **Coordination Layer**: Launch barrier synchronization

### Cross-Module Dependencies
- All modules depend on `@debugmcp/shared` for FileSystem abstraction
- executable-resolver.ts utilities are consumed by typescript-detector.ts
- Common patterns: no-throw filesystem operations, dependency injection, caching

### Data Flow Patterns
- **Heuristic Detection**: Multiple fallback strategies (file extensions → package.json → tsconfig.json)
- **Local-First Resolution**: Prefers project-local installations over global PATH
- **Fail-Safe Design**: Returns safe defaults rather than throwing errors

## Important Patterns and Conventions

### Error Resilience
- All filesystem operations wrapped in try-catch blocks
- Graceful degradation with sensible defaults
- No-throw design philosophy across all modules

### Platform Abstraction
- Windows vs Unix executable naming conventions handled transparently
- Cross-platform path resolution using Node.js path module
- Platform-specific binary candidates with fallbacks

### Performance Optimization
- Module-wide caching in typescript-detector
- Synchronous operations where possible to avoid async complexity
- Deterministic resolution without spawning external processes

### Testability
- Configurable filesystem abstraction via dependency injection
- Cache clearing utilities for test isolation
- Separation of concerns enabling focused unit testing