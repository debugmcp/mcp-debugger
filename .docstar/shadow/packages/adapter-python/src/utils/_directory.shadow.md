# packages/adapter-python/src/utils/
@generated: 2026-02-10T21:26:24Z

## Purpose
The `utils` directory provides cross-platform Python executable discovery and validation utilities for the adapter-python package. It handles the complex task of finding suitable Python installations across different operating systems, with special handling for Windows Store aliases and debugpy integration requirements.

## Key Components and Architecture

### Core Functionality
The directory centers around **Python executable discovery** with robust cross-platform support. The main workflow follows a priority-based discovery strategy:

1. **Preferred Path Resolution** - Uses provided path if available
2. **Environment Variable Lookup** - Checks standard Python environment variables  
3. **Auto-Detection** - Searches system PATH with intelligent filtering
4. **Validation** - Tests executables to ensure they're functional and not aliases
5. **debugpy Preference** - Prioritizes Python installations with debugpy available

### Command Resolution Infrastructure
- **CommandFinder Interface**: Abstraction layer allowing pluggable command resolution strategies
- **WhichCommandFinder**: Primary implementation using the `which` library with extensive Windows-specific logic
- **Caching System**: Performance optimization through resolved path caching
- **Fallback Mechanisms**: Direct spawn testing when standard resolution fails

### Platform-Specific Handling
The utilities include sophisticated **Windows compatibility layers**:
- Windows Store Python alias detection and filtering using regex patterns
- PATH/Path environment variable case sensitivity normalization
- ComSpec fallback prevention for `which` library failures
- Exit code 9009 detection for Store alias identification

## Public API Surface

### Primary Entry Points
- **`findPythonExecutable(preferredPath?, pythonLocation?, logger?)`**: Main function for Python discovery with configurable preferences and logging
- **`getPythonVersion(pythonPath)`**: Version extraction utility for Python executables
- **`hasDebugpy(pythonPath)`**: debugpy availability checker for Python installations
- **`isValidPythonExecutable(pythonPath)`**: Validation utility to test executable functionality

### Configuration and Testing
- **`setDefaultCommandFinder(finder)`**: Dependency injection for testing and customization
- **Logger interface**: Pluggable logging support for diagnostic output
- **DEBUG_PYTHON_DISCOVERY**: Environment variable for verbose discovery mode

## Internal Organization and Data Flow

The module follows a **layered architecture**:

1. **Discovery Layer**: `findPythonExecutable()` orchestrates the discovery process
2. **Resolution Layer**: `CommandFinder` implementations handle platform-specific command location  
3. **Validation Layer**: Executable testing and Windows Store alias filtering
4. **Utility Layer**: Version checking, debugpy detection, and helper functions

**Data Flow**: Preferred paths → Environment variables → System PATH search → Validation → debugpy preference → Final selection

## Important Patterns and Conventions

### Error Handling Strategy
- **Graceful Degradation**: Multiple fallback strategies ensure Python discovery succeeds when possible
- **Custom Error Types**: `CommandNotFoundError` provides structured error information
- **Comprehensive Logging**: CI-aware error reporting with detailed diagnostic information

### Cross-Platform Design
- **Platform Abstraction**: Single API surface with platform-specific implementation details
- **Windows-First Complexity**: Extensive Windows Store handling while maintaining Unix/macOS compatibility
- **Environment Normalization**: Consistent behavior across different shell environments

### Performance Optimization
- **Result Caching**: Command resolution results cached to avoid repeated expensive operations
- **Lazy Evaluation**: debugpy checking only performed when multiple candidates exist
- **Efficient Validation**: Minimal subprocess calls for executable testing

This utility module serves as the foundation for Python environment detection in the adapter-python package, providing reliable cross-platform Python discovery with intelligent handling of modern Windows Python distribution complexities.