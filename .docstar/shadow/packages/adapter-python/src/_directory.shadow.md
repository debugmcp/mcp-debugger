# packages\adapter-python\src/
@children-hash: d9d684a38e03ab57
@generated: 2026-02-23T15:26:32Z

## Purpose
The `packages/adapter-python/src` directory implements a comprehensive Python debugging adapter for the mcp-debugger system. It provides Python-specific debugging capabilities through the Debug Adapter Protocol (DAP), handling Python environment discovery, validation, debugpy integration, and debug session management.

## Key Components and Architecture

### Core Adapter Components
- **PythonDebugAdapter**: Main adapter class implementing the `IDebugAdapter` interface, managing Python debug sessions, DAP protocol operations, and debugpy integration
- **PythonAdapterFactory**: Factory implementation for creating and validating Python adapter instances with environment checking
- **index.ts**: Entry point module providing centralized exports for the entire package

### Python Environment Management (`utils/`)
- **python-utils.ts**: Sophisticated cross-platform Python executable discovery system with Windows Store alias filtering and debugpy-aware selection
- **CommandFinder Interface**: Pluggable command resolution system with caching for performance optimization

## Public API Surface

### Main Entry Points
- `PythonDebugAdapter`: Core debug adapter with full DAP protocol support
- `PythonAdapterFactory`: Factory for adapter creation with validation capabilities
- `findPythonExecutable()`: Primary utility for Python executable discovery
- `getPythonVersion()`: Python version extraction utility

### Configuration Support
- `PythonLaunchConfig`: Extended launch configuration for Python-specific debugging options (Django/Flask, subprocess debugging, module execution)
- Command finder dependency injection via `setDefaultCommandFinder()`

## Internal Organization and Data Flow

### Initialization Flow
1. **Factory Validation**: PythonAdapterFactory validates Python environment (version 3.7+, debugpy availability)
2. **Adapter Creation**: Factory instantiates PythonDebugAdapter with validated dependencies
3. **Environment Setup**: Adapter initializes with cached Python executable paths and metadata

### Debug Session Flow
1. **Configuration Transform**: Generic launch configs converted to Python-specific configurations
2. **Command Building**: Platform-appropriate debugpy commands constructed with environment variables
3. **DAP Operations**: Request validation, event handling, and capability reporting for Python debugging
4. **State Management**: Thread tracking, connection status, and lifecycle management

### Discovery and Validation Pipeline
1. **Multi-source Discovery**: Preferred paths → environment variables → system detection
2. **Platform-aware Validation**: Windows Store alias filtering, executable testing, import verification
3. **Capability Assessment**: Debugpy availability checking with virtualenv compatibility
4. **Caching Layer**: TTL-based caching (60s) for performance optimization

## Important Patterns and Conventions

### Architectural Patterns
- **Factory Pattern**: Clean adapter instantiation with dependency injection
- **Strategy Pattern**: Pluggable command resolution and discovery strategies  
- **State Machine**: Adapter lifecycle management with event emission
- **Caching**: Performance optimization with TTL-based executable path caching

### Error Handling
- Comprehensive validation with structured error/warning reporting
- Graceful degradation through multiple fallback strategies
- User-friendly error translation from low-level Python errors

### Platform Compatibility
- Cross-platform Python discovery with Windows-specific optimizations
- Support for virtual environments and Python version managers
- Robust handling of Windows Store Python aliases and PATH resolution

The module serves as a critical bridge between the mcp-debugger system and Python debugging infrastructure, providing reliable environment detection, comprehensive DAP protocol support, and seamless integration with debugpy for Python development workflows.