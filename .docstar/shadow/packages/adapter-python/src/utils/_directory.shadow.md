# packages\adapter-python\src\utils/
@children-hash: 2a877889d7a20e3f
@generated: 2026-02-15T09:01:24Z

## Purpose
This directory contains Python executable detection and validation utilities for the adapter-python package. It provides a comprehensive, cross-platform solution for discovering and validating Python installations, with sophisticated Windows Store alias filtering and debugpy-aware selection logic.

## Key Components
The module is built around a single primary file `python-utils.ts` that implements a multi-layered Python discovery system:

### Command Resolution Layer
- `CommandFinder` interface with `WhichCommandFinder` implementation
- Uses the `which` library with caching for cross-platform executable resolution
- Handles Windows-specific PATH normalization and ComSpec fallback scenarios

### Python Validation System
- Windows Store alias detection through exit code analysis and stderr pattern matching
- Python executable validation via import testing
- Version extraction and debugpy package detection

### Discovery Strategy Engine
- Multi-priority discovery order: preferred paths → environment variables → pythonLocation → auto-detection
- Debugpy-aware selection that prefers Python installations with debugging capabilities
- Comprehensive fallback mechanisms when primary methods fail

## Public API Surface
The primary entry point is `findPythonExecutable()`, which accepts:
- Optional preferred Python path
- Logger interface for diagnostic output
- Returns validated Python executable path or throws detailed error

Supporting utilities include:
- `isValidPythonExecutable()` - Validates a given Python path
- `hasDebugpy()` - Checks for debugpy package availability  
- `getPythonVersion()` - Extracts version information
- `setDefaultCommandFinder()` - Dependency injection for testing

## Internal Organization
The module follows a layered architecture:

1. **Infrastructure Layer**: Error classes, logging interfaces, and command finder abstractions
2. **Platform Abstraction Layer**: Windows-specific handling while maintaining cross-platform compatibility
3. **Discovery Engine**: Priority-based Python detection with multiple fallback strategies
4. **Validation Layer**: Executable testing and capability detection

## Data Flow
1. Discovery phase evaluates multiple sources in priority order
2. Each candidate undergoes validation to filter out Windows Store aliases
3. Valid candidates are assessed for debugpy availability
4. Best candidate is selected based on capabilities and returned
5. Comprehensive error reporting provides actionable feedback on failures

## Important Patterns
- **Strategy Pattern**: Pluggable command resolution via CommandFinder interface
- **Graceful Degradation**: Multiple fallback paths ensure robust discovery
- **Caching**: Performance optimization through result caching
- **Platform-Aware Design**: Extensive Windows-specific logic while maintaining portability
- **Debugging Support**: Environment variable-controlled verbose logging for troubleshooting

The module serves as a critical infrastructure component, ensuring reliable Python executable discovery across diverse deployment environments while prioritizing development-friendly configurations with debugging capabilities.