# packages/adapter-python/src/utils/
@generated: 2026-02-11T23:47:40Z

## Purpose
This utils directory provides core Python executable discovery and validation utilities for the adapter-python package. It serves as the foundation for locating and verifying Python installations across different platforms, with special handling for Windows Store aliases and debugpy integration requirements.

## Key Components and Organization

### Core Functionality
The module centers around **python-utils.ts**, which implements a comprehensive Python discovery system with the following key components:

- **Command Resolution Layer**: `CommandFinder` interface with `WhichCommandFinder` implementation for cross-platform executable location
- **Python Detection Engine**: Multi-strategy Python discovery with preference ordering and validation
- **Platform Abstraction**: Windows-specific handling while maintaining cross-platform compatibility
- **Validation System**: Executable verification to filter out problematic installations (Windows Store aliases)

### Internal Architecture
The module follows a layered approach:
1. **Discovery Layer**: Multiple detection strategies (preferred paths, environment variables, auto-detection)
2. **Validation Layer**: Python executable verification and Windows Store alias filtering
3. **Enhancement Layer**: debugpy detection for development environment optimization
4. **Utility Layer**: Version extraction and command-line tool resolution

## Public API Surface

### Primary Entry Points
- **`findPythonExecutable(options?)`**: Main function for Python discovery with configurable search strategies
- **`getPythonVersion(pythonPath)`**: Extracts version information from Python executable
- **`isValidPythonExecutable(pythonPath)`**: Validates Python installation functionality
- **`hasDebugpy(pythonPath)`**: Checks for debugpy package availability

### Configuration Points
- **`setDefaultCommandFinder(finder)`**: Dependency injection for testing and customization
- **Environment Variables**: `DEBUG_PYTHON_DISCOVERY` for verbose logging, standard Python path variables
- **Logger Interface**: Pluggable logging system for diagnostic output

## Data Flow and Integration Patterns

### Discovery Process Flow
1. **Priority Resolution**: Preferred path → environment variables → auto-detection
2. **Candidate Validation**: Filter Windows Store aliases and validate executability  
3. **Enhancement Detection**: Prefer installations with debugpy for debugging capabilities
4. **Fallback Strategy**: Graceful degradation through multiple discovery methods

### Cross-Platform Handling
- **Windows Specialization**: Store alias filtering, PATH normalization, ComSpec fallbacks
- **Unix Compatibility**: Standard which-based resolution with spawn validation
- **Error Resilience**: Multiple fallback strategies and comprehensive error reporting

## Important Patterns and Conventions

### Architectural Patterns
- **Strategy Pattern**: Pluggable command finder for testing and customization
- **Caching**: Performance optimization through result caching in WhichCommandFinder
- **Graceful Degradation**: Multiple fallback strategies ensure robustness
- **Platform Abstraction**: Unified interface with platform-specific implementations

### Error Handling Philosophy
- Custom `CommandNotFoundError` for clear failure communication
- Extensive validation to prevent problematic Python installations
- CI-aware error reporting with detailed diagnostic information
- Non-blocking debugpy detection (preference, not requirement)

## Role in Larger System
This utils module serves as the foundational Python discovery system for the adapter-python package, providing reliable cross-platform Python executable location and validation. It abstracts the complexity of Python installation detection from higher-level adapter components while ensuring compatibility with development environments through debugpy integration.