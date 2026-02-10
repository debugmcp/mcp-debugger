# packages/adapter-python/src/utils/
@generated: 2026-02-09T18:16:12Z

## Purpose

The `utils` directory provides cross-platform Python executable discovery and validation utilities for Node.js applications. This module serves as the foundation for Python environment detection in the adapter-python package, with specialized handling for Windows environments and robust error recovery mechanisms.

## Key Components

### Python Discovery Engine
- **`findPythonExecutable()`** - Main entry point implementing multi-stage Python discovery strategy
- **Command Finding Abstraction** - `CommandFinder` interface with `WhichCommandFinder` implementation for executable discovery
- **Validation Pipeline** - `isValidPythonExecutable()` and `hasDebugpy()` functions for Python installation verification

### Windows Compatibility Layer
- **Store Alias Filtering** - Detects and excludes non-functional Microsoft Store Python shortcuts
- **Path Environment Handling** - Resolves Windows-specific PATH variable case sensitivity issues
- **ComSpec Fallbacks** - Ensures cmd.exe availability for process spawning

### Error Handling and Recovery
- **`CommandNotFoundError`** - Custom error type with command context
- **Multi-candidate Resolution** - Set-based deduplication and fallback mechanisms
- **Comprehensive Diagnostics** - Extensive logging and error reporting with tried paths

## Public API Surface

### Primary Entry Points
- `findPythonExecutable(preferredPath?: string, logger?: Logger): Promise<string>` - Main Python discovery function
- `getPythonVersion(pythonPath: string): Promise<string | null>` - Version extraction utility
- `isValidPythonExecutable(pythonPath: string): Promise<boolean>` - Python validation checker
- `hasDebugpy(pythonPath: string): Promise<boolean>` - debugpy module availability test

### Configuration Interface
- Environment variable support: `PYTHON_PATH`, `PYTHON_EXECUTABLE`, `pythonLocation`
- Debug mode activation via `DEBUG_PYTHON_DISCOVERY`
- Test overrides through `setDefaultCommandFinder()`

## Internal Organization

### Discovery Strategy Flow
1. **User Preference** - Honor explicitly provided preferred path
2. **Environment Variables** - Check standard Python environment configurations
3. **Platform-Specific Paths** - GitHub Actions and CI environment support
4. **Auto-Detection** - Search common Python command variants (python3, python, py)
5. **Feature-Based Selection** - Prioritize installations with debugpy support
6. **Fallback Resolution** - Select first valid Python installation found

### Data Flow Patterns
- **Caching Layer** - LRU-style caching in `WhichCommandFinder` for performance
- **Validation Pipeline** - All discovered candidates pass through validation filters
- **Error Aggregation** - Comprehensive error reporting with all attempted paths
- **Logging Integration** - Structured logging throughout discovery process

## Important Patterns

### Cross-Platform Compatibility
- Platform detection via `process.platform === 'win32'`
- Conditional path handling and command resolution
- Windows Store alias detection via regex patterns

### Dependency Injection
- `CommandFinder` interface enables testing and mocking
- Configurable caching behavior
- Logger interface abstraction for flexible logging backends

### Robust Error Handling
- Multi-stage fallback mechanisms prevent total failure
- Detailed error context preservation
- Graceful degradation when optional features unavailable

This utility module serves as a critical infrastructure component, ensuring reliable Python environment detection across diverse deployment scenarios while maintaining strong Windows compatibility and comprehensive error recovery.