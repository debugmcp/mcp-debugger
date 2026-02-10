# packages/adapter-python/src/utils/
@generated: 2026-02-10T01:19:40Z

## Purpose

The `packages/adapter-python/src/utils` directory provides core Python environment discovery and validation utilities for the adapter-python package. It serves as the foundational layer for locating, validating, and managing Python executable detection across different platforms, with specialized handling for Windows-specific challenges like Store aliases and path resolution issues.

## Key Components and Architecture

### Core Functionality
The module centers around robust Python executable discovery through multiple strategies:
- **Environment-based detection**: Checks standard environment variables and user-specified paths
- **System-wide discovery**: Uses cross-platform command resolution via the `which` library
- **Validation pipeline**: Tests discovered executables to ensure they're functional Python interpreters
- **Preference system**: Prioritizes Python installations that have debugging capabilities (debugpy)

### Primary API Surface

**Main Entry Point:**
- `findPythonExecutable()`: The primary public interface for Python discovery, implementing a comprehensive fallback strategy with preference ordering

**Validation Functions:**
- `isValidPythonExecutable()`: Validates discovered Python executables and filters out problematic installations
- `hasDebugpy()`: Determines debugging capabilities of Python installations
- `getPythonVersion()`: Extracts version information from Python executables

**Configuration:**
- `setDefaultCommandFinder()`: Allows dependency injection for testing and custom resolution strategies

### Internal Organization

The module follows a layered architecture:

1. **Abstraction Layer**: `CommandFinder` interface and `Logger` interface provide pluggable components
2. **Implementation Layer**: `WhichCommandFinder` class handles the actual command resolution with platform-specific optimizations
3. **Utility Layer**: Helper functions for validation, version detection, and debugging capability checks
4. **Integration Layer**: Main discovery function orchestrates all components

### Data Flow

1. **Input Processing**: Accepts preferred paths, environment variables, and configuration options
2. **Discovery Phase**: Tries multiple strategies in priority order (preferred → environment → system-wide)
3. **Validation Phase**: Each discovered candidate is tested for validity and Windows Store alias filtering
4. **Selection Phase**: Prefers installations with debugpy, falls back to any valid Python
5. **Result**: Returns validated Python executable path or throws descriptive errors

## Platform-Specific Handling

### Windows Optimizations
- **Store Alias Filtering**: Actively detects and rejects Windows Store Python aliases that don't provide full functionality
- **Path Normalization**: Handles PATH/Path case sensitivity issues in Windows environments
- **ComSpec Fallback**: Prevents `which` library failures by ensuring proper shell environment
- **Direct Spawn Testing**: Falls back to direct process spawning when `which` resolution fails

### Cross-Platform Considerations
- Uses the `which` library for consistent command resolution across platforms
- Implements platform-agnostic validation through Python import tests
- Provides consistent error handling and logging interfaces

## Error Handling Strategy

The module implements comprehensive error handling with:
- **Custom Error Types**: `CommandNotFoundError` for specific failure cases
- **Graceful Degradation**: Multiple fallback strategies prevent total failure
- **Detailed Diagnostics**: CI-specific logging and debug mode for troubleshooting
- **User-Friendly Messages**: Clear error reporting with actionable guidance

## Key Patterns

- **Strategy Pattern**: Pluggable command finders allow for testing and customization
- **Caching**: Results are cached for performance optimization
- **Progressive Fallback**: Multiple discovery strategies tried in logical order
- **Validation-First**: All discovered executables are validated before use
- **Environment-Aware**: Respects user configuration while providing intelligent defaults

This utility module serves as the critical foundation for Python environment detection in the adapter-python package, ensuring reliable executable discovery across diverse development environments.