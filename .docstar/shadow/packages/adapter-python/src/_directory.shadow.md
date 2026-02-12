# packages/adapter-python/src/
@generated: 2026-02-11T23:47:58Z

## Purpose
The `packages/adapter-python/src` directory provides a complete Python debugging adapter implementation for the mcp-debugger framework. It serves as a bridge between the Debug Adapter Protocol (DAP) and Python's debugpy debugging infrastructure, enabling Python debugging sessions with comprehensive environment validation and cross-platform support.

## Key Components and Integration

### Core Architecture
The directory implements a layered architecture with clear separation of concerns:

1. **Entry Point Layer** (`index.ts`): Centralized export interface providing clean access to all public APIs
2. **Factory Layer** (`python-adapter-factory.ts`): Implements dependency injection pattern for adapter creation with comprehensive environment validation
3. **Adapter Layer** (`python-debug-adapter.ts`): Core DAP protocol implementation with Python-specific debugging capabilities
4. **Utility Layer** (`utils/`): Cross-platform Python executable discovery and validation system

### Component Relationships
- **PythonAdapterFactory** creates **PythonDebugAdapter** instances after validating the Python environment
- **PythonDebugAdapter** uses utilities from `utils/python-utils.ts` for executable resolution and environment detection
- Both factory and adapter leverage the utility layer for Python version checking and debugpy installation validation
- The factory performs upfront validation while the adapter manages runtime debugging operations

## Public API Surface

### Main Entry Points
- **PythonAdapterFactory**: Factory class implementing `IAdapterFactory` for adapter creation and validation
- **PythonDebugAdapter**: Core adapter implementing `IDebugAdapter` for debugging session management
- **findPythonExecutable()**: Primary utility for cross-platform Python discovery
- **getPythonVersion()**: Python version extraction utility

### Configuration and Customization
- **setDefaultCommandFinder()**: Dependency injection for custom command resolution
- **PythonLaunchConfig**: Extended launch configuration interface for Python-specific options
- **CommandFinder**: Type interface for pluggable command discovery

## Internal Organization and Data Flow

### Validation Pipeline
1. **Environment Validation**: Factory validates Python ≥3.7 and debugpy installation
2. **Executable Discovery**: Multi-strategy Python detection with platform-specific handling
3. **Capability Assessment**: Adapter determines DAP capabilities based on Python environment
4. **Runtime Management**: Adapter manages debugging sessions with state tracking and event handling

### Cross-Platform Strategy
- **Windows Specialization**: Handles Windows Store Python aliases and PATH normalization
- **Unix Compatibility**: Uses standard `which`-based resolution with spawn validation
- **Fallback Mechanisms**: Multiple discovery strategies ensure robustness across environments

## Important Patterns and Conventions

### Architectural Patterns
- **Factory Pattern**: Clean adapter instantiation with validation
- **Caching**: TTL-based caching for Python executable paths and metadata (60-second timeout)
- **State Machine**: Adapter lifecycle management with event emission
- **Strategy Pattern**: Pluggable command finding for testing and customization

### Python-Specific Features
- **Virtual Environment Detection**: Automatic detection and handling of Python virtual environments
- **debugpy Integration**: Comprehensive integration with Python's official debugging protocol
- **Module Execution**: Support for both script and module-based debugging (`python -m`)
- **Framework Support**: Django/Flask debugging capabilities through specialized launch configurations

### Error Handling
- **Custom Exceptions**: `CommandNotFoundError` for clear failure communication
- **Validation Results**: Structured validation with errors, warnings, and environment details
- **Graceful Degradation**: Multiple fallback strategies for robust Python discovery

## Critical Requirements and Constraints
- **Python Version**: Requires Python 3.7 or higher
- **debugpy Dependency**: Validates debugpy package installation for debugging functionality
- **Platform Support**: Cross-platform compatibility with Windows, macOS, and Linux
- **DAP Compliance**: Full Debug Adapter Protocol implementation with Python-specific extensions

This directory serves as a complete, production-ready Python debugging solution within the mcp-debugger ecosystem, providing robust environment detection, comprehensive validation, and full DAP protocol support for Python debugging sessions.