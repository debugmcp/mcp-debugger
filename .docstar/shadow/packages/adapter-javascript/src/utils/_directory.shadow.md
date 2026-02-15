# packages\adapter-javascript\src\utils/
@children-hash: ce8ae4742261a4f8
@generated: 2026-02-15T09:01:27Z

## Purpose
Core utilities package for the JavaScript/TypeScript debugging adapter, providing cross-platform executable resolution, project configuration detection, launch coordination, and TypeScript runtime detection. These utilities form the foundational layer that enables the adapter to automatically configure debugging environments based on project characteristics.

## Key Components and Relationships

### Configuration Detection Pipeline
- **config-transformer.ts**: Main configuration analysis engine that detects ESM projects, TypeScript path mappings, and output file patterns through filesystem inspection
- **typescript-detector.ts**: Specialized detector for TypeScript runtime executables (tsx, ts-node) with local-first resolution strategy
- **executable-resolver.ts**: Cross-platform Node.js executable path resolution without process spawning

### Launch Coordination
- **js-debug-launch-barrier.ts**: Implements barrier pattern for coordinating debugger launch readiness, waiting for DAP events or adapter connection status

### Unified Architecture Patterns
All utilities share common design principles:
- **No-throw filesystem operations**: All components catch and handle filesystem errors gracefully
- **Dependency injection**: FileSystem abstraction enables testing with mock implementations
- **Cross-platform compatibility**: Platform-aware binary resolution and path handling
- **Performance optimization**: Caching mechanisms and process-level state management

## Public API Surface

### Main Entry Points
- `transformConfig(config)`: Primary configuration transformation orchestrator
- `findNode(preferredPath?, fileSystem?)`: Cross-platform Node.js executable resolution
- `detectTsRunners(cwd?, fileSystem?)`: TypeScript runtime detection with caching
- `JsDebugLaunchBarrier`: Launch coordination class implementing AdapterLaunchBarrier interface

### Configuration Detection APIs
- `isESMProject(programPath, cwd, fileSystem?)`: ESM project detection via multiple heuristics
- `hasTsConfigPaths(cwdOrProgramDir, fileSystem?)`: TypeScript path mapping detection
- `determineOutFiles(programPath, userOutFiles?)`: Output file pattern resolution

### Testing Support
- `setDefaultFileSystem()`: Injects filesystem implementation across all utilities
- `clearCache()`: Resets module-wide detection caches

## Internal Organization and Data Flow

### Detection Flow
1. **Project Analysis**: config-transformer examines package.json, tsconfig.json, and file extensions
2. **Executable Resolution**: executable-resolver and typescript-detector locate runtime binaries
3. **Configuration Assembly**: Results combined to produce adapter configuration
4. **Launch Coordination**: js-debug-launch-barrier synchronizes debugger startup

### Data Flow Patterns
- **Heuristic-based detection**: Multi-strategy fallback approach for robust configuration detection
- **Local-first resolution**: Prioritizes project-local executables over system-wide installations
- **Precedence hierarchies**: Well-defined resolution order (e.g., file extension → package.json → tsconfig.json)

## Important Conventions

### Error Handling
- All filesystem operations wrapped in try-catch blocks
- Undefined/default returns rather than throwing exceptions
- Graceful degradation with sensible fallbacks

### Platform Support
- Windows-specific handling for .exe, .cmd extensions
- PATH environment variable respect across platforms
- Absolute path resolution for consistent behavior

### Performance Considerations
- Module-wide caching for expensive detection operations
- Synchronous filesystem operations where possible
- Lazy evaluation patterns to minimize unnecessary work

This utility package serves as the intelligent configuration layer that automatically adapts debugging behavior based on project structure and available tooling, reducing manual configuration requirements while maintaining reliability across diverse JavaScript/TypeScript environments.