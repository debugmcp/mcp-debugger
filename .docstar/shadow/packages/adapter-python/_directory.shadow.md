# packages\adapter-python/
@generated: 2026-02-12T21:06:20Z

## Overall Purpose & Responsibility

The `packages/adapter-python` directory provides a complete Python debugging adapter implementation for the DebugMCP framework. This module serves as a language-specific adapter that enables debugging Python applications by bridging the Debug Adapter Protocol (DAP) with Python's debugpy debugging infrastructure. It handles the complexities of Python environment discovery, validation, and debugging session management across multiple platforms.

## Key Components & Integration

### Core Architecture
The module follows a layered architecture with clear separation of concerns:

- **PythonDebugAdapter** (`src/`): The primary adapter implementation that manages debugging sessions, handles DAP protocol operations, and maintains debugging state throughout the session lifecycle
- **PythonAdapterFactory** (`src/`): Factory class responsible for creating and validating Python adapter instances, implementing dependency injection patterns and environment validation
- **Python Utils** (`src/`): Comprehensive Python executable discovery system with cross-platform support, version validation, and debugpy capability detection
- **Test Suite** (`tests/`): Two-tier testing strategy with smoke tests for basic functionality and comprehensive unit tests for behavioral validation

### Integration Flow
The components work together through a structured pipeline:

1. **Environment Discovery**: Utils module locates valid Python installations across Windows, macOS, and Linux platforms
2. **Validation Pipeline**: Factory validates Python 3.7+ compatibility and debugpy availability with TTL-based caching
3. **Adapter Creation**: Factory instantiates PythonDebugAdapter with validated environment configuration
4. **Debugging Session**: Adapter manages DAP protocol translation to debugpy commands and maintains session state

## Public API Surface

### Main Entry Points
- **PythonDebugAdapter**: Core debugging functionality with full DAP protocol support and session management
- **PythonAdapterFactory**: Primary factory interface for adapter instantiation with built-in validation
- **findPythonExecutable(options?)**: Cross-platform Python discovery with configurable preferences and fallback mechanisms
- **getPythonVersion(pythonPath)**: Version extraction utility for Python installation validation

### Utility Functions
- `isValidPythonExecutable(path)`: Executable validation with comprehensive compatibility checks
- `hasDebugpy(pythonPath)`: Debugging capability detection for ensuring debugpy availability
- `setDefaultCommandFinder(finder)`: Configuration interface for custom command discovery strategies
- `CommandNotFoundError`: Specialized error handling for command resolution failures

### Configuration Types
- `CommandFinder`: Interface for pluggable command discovery mechanisms
- `PythonLaunchConfig`: Extended launch configuration supporting Python-specific debugging options

## Internal Organization & Data Flow

### Environment Discovery Pipeline
```
Discovery Request → Platform Detection → Executable Search → Version Validation → Debugpy Check → Caching → Result
```

### Debugging Session Lifecycle
```
Factory Validation → Adapter Initialization → DAP Protocol Setup → Debugpy Integration → Session Management → Cleanup
```

## Important Patterns & Conventions

### Cross-Platform Abstraction
- **Windows Support**: PATH normalization, Windows Store Python filtering, and registry-based discovery
- **Unix Systems**: Standard executable discovery with virtual environment detection
- **Development Integration**: IDE-specific Python configuration support with environment variable precedence

### Robust Error Handling
- **Graceful Degradation**: Multiple fallback mechanisms for Python discovery across different installation types
- **Validation Strategy**: Multi-stage environment validation with blocking errors for critical issues and warnings for non-critical problems
- **User Experience**: Translation of technical errors into actionable user messages

### Performance Optimization
- **Caching Strategy**: TTL-based caching (60-second timeout) for expensive operations like executable discovery and version detection
- **Lazy Initialization**: On-demand validation and adapter creation to minimize startup overhead
- **Resource Management**: Proper cleanup and disposal patterns for debugging sessions and system resources

## Critical Requirements & Dependencies

- **Python Version Constraint**: Enforces Python 3.7+ across all components with version validation
- **Debugpy Dependency**: Validates debugpy package availability as a prerequisite for debugging functionality
- **Platform Compatibility**: Comprehensive support for Windows, macOS, and Linux with platform-specific optimizations
- **MCP Integration**: Seamless integration with the broader DebugMCP ecosystem through standardized factory and adapter patterns

This module serves as the definitive Python debugging solution within the DebugMCP framework, providing production-ready functionality with robust environment management, comprehensive testing coverage, and cross-platform reliability.