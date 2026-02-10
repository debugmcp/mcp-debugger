# packages/adapter-javascript/src/utils/
@generated: 2026-02-09T18:16:15Z

## Overall Purpose & Responsibility

The `utils` directory provides essential utilities for the JavaScript/TypeScript debugging adapter, focusing on environment detection, executable resolution, and project configuration analysis. These utilities enable the adapter to intelligently configure debugging sessions by detecting project characteristics, locating runtime executables, and coordinating launch sequences without external process spawning.

## Key Components & Relationships

### Configuration & Project Analysis
- **`config-transformer.ts`**: Core configuration detection and transformation utilities
  - Detects ESM vs CommonJS projects through multiple heuristics
  - Analyzes TypeScript configuration for paths and module settings
  - Provides safe output file pattern determination
  - Uses defensive programming with no-throw guarantees

### Executable Resolution
- **`executable-resolver.ts`**: Cross-platform Node.js executable discovery
  - Implements 4-tier precedence for Node.js path resolution
  - Provides PATH search utilities respecting directory ordering
  - Returns deterministic results without subprocess spawning
- **`typescript-detector.ts`**: TypeScript runtime detection (tsx, ts-node)
  - Prioritizes local node_modules installations over global PATH
  - Implements module-level caching for performance
  - Handles Windows executable suffix variations

### Launch Coordination
- **`js-debug-launch-barrier.ts`**: Launch readiness coordination
  - Implements barrier pattern for js-debug adapter startup
  - Coordinates through DAP events or adapter connection signals
  - Provides timeout protection and resource cleanup

## Public API Surface

### Main Entry Points
- **`findNode(preferredPath?, fileSystem?)`**: Primary Node.js executable resolution
- **`detectTsRunners()`**: Async TypeScript runtime detection with caching
- **`isESMProject(program?, cwd?)`**: ESM project detection heuristics  
- **`hasTsConfigPaths(program?, cwd?)`**: TypeScript path mapping detection
- **`determineOutFiles(outFiles?)`**: Output file pattern determination
- **`JsDebugLaunchBarrier`**: Launch coordination class for js-debug adapter

### Configuration APIs
- **`setDefaultFileSystem(fs)`**: Dependency injection across all modules
- **`clearCache()`**: Cache invalidation for TypeScript detection
- **`transformConfig(config)`**: Back-compatibility placeholder

## Internal Organization & Data Flow

### Filesystem Abstraction Layer
All utilities use injectable `FileSystem` interface with `NodeFileSystem` default, enabling:
- Hermetic testing without real filesystem access
- Consistent error handling across modules
- Platform-agnostic file operations

### Detection Pipeline
1. **Project Analysis**: `config-transformer` analyzes project structure and configuration files
2. **Executable Resolution**: `executable-resolver` and `typescript-detector` locate required runtimes
3. **Launch Coordination**: `js-debug-launch-barrier` manages startup sequencing

### Caching Strategy
- **TypeScript Detection**: Module-level caching with explicit invalidation
- **Configuration Analysis**: Per-call analysis with filesystem dependency injection
- **Executable Resolution**: No caching, deterministic resolution per call

## Important Patterns & Conventions

### Error Resilience
- **No-throw Design**: All functions catch and handle filesystem errors gracefully
- **Defensive Programming**: Default values and fallback strategies throughout
- **Silent Failure Mode**: Returns undefined/defaults rather than propagating errors

### Platform Adaptation
- **Windows Support**: Handles executable suffixes (.cmd, .exe) in detection
- **PATH Precedence**: Respects directory ordering in PATH searches
- **Cross-platform Paths**: Consistent absolute path resolution

### Testability
- **Dependency Injection**: FileSystem abstraction enables isolated testing
- **Cache Control**: Explicit cache management for test reproducibility
- **Deterministic Behavior**: Consistent results across different environments

### Performance Considerations
- **No Process Spawning**: All detection through filesystem operations only
- **Lazy Evaluation**: TypeScript detection only runs when explicitly called
- **Efficient Caching**: Module-level memoization reduces repeated filesystem access

This utility collection forms the foundation for intelligent JavaScript/TypeScript debugging configuration, providing the adapter with comprehensive environment awareness while maintaining reliability and testability.