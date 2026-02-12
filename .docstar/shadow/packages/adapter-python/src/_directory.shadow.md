# packages\adapter-python\src/
@generated: 2026-02-12T21:06:00Z

## Purpose
The `packages/adapter-python/src` directory provides a complete Python debugging adapter implementation for the MCP debugger framework. It serves as a specialized adapter that enables debugging Python applications using the Debug Adapter Protocol (DAP) and debugpy, with intelligent Python environment discovery and validation.

## Key Components and Integration

### Core Adapter Architecture
- **PythonDebugAdapter**: The primary adapter implementation that manages Python debugging sessions, handles DAP protocol operations, and maintains debugging state
- **PythonAdapterFactory**: Factory class that creates and validates Python adapter instances, implementing dependency injection patterns for the MCP framework
- **index.ts**: Centralized entry point providing clean exports of all public APIs

### Python Environment Management
- **Utils Module**: Comprehensive Python executable discovery system with cross-platform support, Windows Store filtering, and debugpy capability detection
- **Validation Pipeline**: Multi-stage environment validation ensuring Python 3.7+ compatibility and debugpy availability
- **Caching Layer**: TTL-based caching (60-second timeout) for Python executable paths and metadata to optimize performance

### Integration Flow
1. **Discovery**: Utils module locates valid Python installations across platforms
2. **Factory Creation**: PythonAdapterFactory validates environment and creates adapter instances
3. **Adapter Operation**: PythonDebugAdapter manages debugging sessions using discovered Python executables
4. **Protocol Translation**: Converts generic DAP operations to Python-specific debugpy commands

## Public API Surface

### Main Entry Points
- `PythonDebugAdapter`: Core debugging functionality with DAP protocol support
- `PythonAdapterFactory`: Adapter instantiation and environment validation
- `findPythonExecutable(options?)`: Primary Python discovery function with configurable preferences
- `getPythonVersion(pythonPath)`: Version extraction from Python installations

### Utility Functions
- `isValidPythonExecutable(path)`: Executable validation
- `hasDebugpy(pythonPath)`: Debugging capability detection
- `setDefaultCommandFinder(finder)`: Custom command discovery configuration
- `CommandNotFoundError`: Specialized error handling for command resolution failures

### Type Definitions
- `CommandFinder`: Interface for pluggable command discovery
- `PythonLaunchConfig`: Extended launch configuration for Python-specific debugging options

## Internal Organization and Data Flow

### Environment Discovery Pipeline
```
User Request → findPythonExecutable() → Validation → Debugpy Check → Caching → Adapter Creation
```

### Debugging Session Flow
```
Factory Validation → Adapter Initialization → DAP Protocol Handling → Debugpy Integration → Session Management
```

## Important Patterns and Conventions

### Platform Abstraction
- Windows-specific handling for PATH normalization and Store filtering
- Cross-platform process spawning for validation and version detection
- Environment-aware discovery strategies with CI/CD integration

### Error Handling Strategy
- Graceful degradation through multiple fallback mechanisms
- Comprehensive validation with blocking errors and non-blocking warnings
- Custom error types for precise failure classification

### Configuration Management
- Dependency injection for testability and customization
- Environment variable integration for debug mode and preferences
- Configurable command resolution with caching optimization

## Critical Requirements and Constraints
- **Python Version**: Enforces Python 3.7+ requirement across all components
- **Debugpy Dependency**: Validates debugpy package availability for debugging functionality
- **Platform Support**: Handles Windows, macOS, and Linux with platform-specific optimizations
- **State Management**: Thread-safe caching and state tracking for concurrent debugging sessions
- **Performance**: Implements caching strategies to minimize expensive executable discovery operations

This directory serves as a complete, production-ready Python debugging solution that seamlessly integrates with the broader MCP debugger ecosystem while providing robust Python-specific functionality and environment management.