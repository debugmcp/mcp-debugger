# packages/adapter-python/
@generated: 2026-02-11T23:48:14Z

## Purpose and Responsibility

The `packages/adapter-python` directory provides a complete Python debugging adapter implementation for the mcp-debugger framework. It serves as a critical bridge between the Debug Adapter Protocol (DAP) and Python's debugpy debugging infrastructure, enabling full-featured Python debugging sessions with comprehensive environment validation and cross-platform support.

## Key Components and Architecture

### Core Component Structure
The package implements a layered architecture with clear separation of concerns:

1. **Factory Layer** (`PythonAdapterFactory`): Implements dependency injection pattern with comprehensive Python environment validation before adapter creation
2. **Adapter Layer** (`PythonDebugAdapter`): Core DAP protocol implementation providing Python-specific debugging capabilities and session management
3. **Discovery Layer** (`utils/python-utils.ts`): Cross-platform Python executable discovery and environment validation system
4. **Test Infrastructure**: Comprehensive test suite ensuring cross-platform reliability and error handling

### Component Integration Flow
```
Environment Discovery → Validation Pipeline → Factory Creation → Adapter Instantiation → Debug Session Management
```

The factory validates Python environments (≥3.7, debugpy availability) before creating adapters. Adapters then manage debugging sessions with full DAP compliance and Python-specific features like virtual environment detection and module execution support.

## Public API Surface

### Primary Entry Points
- **`PythonAdapterFactory`**: Main factory class implementing `IAdapterFactory` for creating validated Python debug adapters
- **`PythonDebugAdapter`**: Core adapter class implementing `IDebugAdapter` for debug session management
- **`findPythonExecutable()`**: Utility for cross-platform Python executable discovery
- **`getPythonVersion()`**: Python version extraction and validation utility

### Configuration Interface
- **`PythonLaunchConfig`**: Extended configuration interface supporting Python-specific debugging options
- **`setDefaultCommandFinder()`**: Dependency injection point for custom command resolution strategies
- **`CommandFinder`**: Pluggable interface for executable discovery customization

## Internal Organization and Data Flow

### Validation and Initialization Pipeline
1. **Multi-Platform Discovery**: Handles Windows Store Python, virtual environments, and standard system installations
2. **Environment Validation**: Ensures Python ≥3.7 and debugpy package availability
3. **Capability Assessment**: Determines supported DAP features based on Python environment
4. **Session Management**: Full lifecycle management with event emission and state tracking

### Cross-Platform Strategy
- **Platform-Specific Handling**: Windows Store Python aliases, Unix PATH resolution, environment variable precedence
- **Fallback Mechanisms**: Multiple discovery strategies ensure robust Python detection across environments
- **Virtual Environment Support**: Automatic detection and proper handling of Python virtual environments

## Important Patterns and Conventions

### Architectural Patterns
- **Factory Pattern**: Clean separation of environment validation from adapter creation
- **Caching Strategy**: TTL-based caching (60-second timeout) for Python executable paths and metadata
- **Event-Driven Design**: Adapter lifecycle managed through event emission with proper state transitions
- **Strategy Pattern**: Pluggable command finding for testing and environment customization

### Python-Specific Features
- **debugpy Integration**: Complete integration with Python's official debugging protocol
- **Module Execution Support**: Debugging for both scripts and modules (`python -m` patterns)
- **Framework Compatibility**: Specialized support for Django/Flask debugging configurations
- **Virtual Environment Awareness**: Seamless handling of conda, venv, and virtualenv setups

### Quality Assurance
- **Comprehensive Testing**: Cross-platform test coverage with mock-based environment simulation
- **Error Handling**: Custom exception types with user-friendly error translation
- **Validation Results**: Structured feedback with errors, warnings, and environment diagnostics
- **CI Integration**: Environment-aware logging and validation for continuous integration

## Critical Requirements
- **Python Version**: Requires Python 3.7 or higher for debugging functionality
- **debugpy Dependency**: Validates debugpy package installation as prerequisite
- **Platform Support**: Full cross-platform compatibility (Windows, macOS, Linux)
- **DAP Compliance**: Complete Debug Adapter Protocol implementation with Python extensions

This package serves as a production-ready, comprehensive Python debugging solution within the mcp-debugger ecosystem, providing robust environment detection, thorough validation, and full-featured debugging capabilities for Python development workflows.