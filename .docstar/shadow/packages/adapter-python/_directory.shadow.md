# packages\adapter-python/
@generated: 2026-02-12T21:01:32Z

## Overall Purpose and Responsibility

The `packages/adapter-python` module is a complete Python debugging adapter implementation for the mcp-debugger framework. It provides seamless integration of Python debugging capabilities through the Debug Adapter Protocol (DAP), handling the complex orchestration between Python environments, the debugpy package, and the debugging framework. The module serves as a bridge that abstracts away Python-specific debugging complexity while providing a standardized debugging interface.

## Key Components and Integration

**Core Adapter Architecture**:
- **`PythonDebugAdapter`**: The main runtime component implementing `IDebugAdapter`, managing debug sessions, DAP protocol communication, and debugpy process orchestration
- **`PythonAdapterFactory`**: Creation and validation layer ensuring proper Python environment setup before adapter instantiation
- **Python Environment Discovery System**: Cross-platform utilities for finding, validating, and working with Python installations

**Supporting Infrastructure**:
- **Utilities Layer (`src/utils/`)**: Foundational services for Python executable discovery, version validation, and dependency verification
- **Configuration System**: Extended launch configurations supporting Python-specific debugging features (Django/Flask, module execution, console types)
- **Test Suite (`tests/`)**: Comprehensive validation covering smoke tests, unit tests, and cross-platform compatibility

## Public API Surface

**Primary Entry Points**:
- **`PythonAdapterFactory`**: Main factory for creating and validating Python debug adapters with environment prerequisite checking
- **`PythonDebugAdapter`**: Core debugging adapter with full DAP protocol implementation and lifecycle management
- **`findPythonExecutable()`**: Standalone utility for Python executable discovery across platforms
- **`getPythonVersion()`**: Version extraction and validation utility
- **`CommandNotFoundError`**: Specialized exception handling for environment issues

**Configuration Interface**:
- **`PythonLaunchConfig`**: Extended configuration supporting Python-specific debugging scenarios
- **`CommandFinder`** interface: Pluggable command resolution strategy with `setDefaultCommandFinder()` for dependency injection

## Internal Organization and Data Flow

**Initialization Pipeline**:
1. **Environment Discovery**: Multi-strategy Python executable search using platform-specific patterns and caching
2. **Validation Layer**: Comprehensive environment validation (Python ≥3.7, debugpy availability, installation integrity)
3. **Factory Creation**: `PythonAdapterFactory` instantiation with validated environment
4. **Adapter Lifecycle**: `PythonDebugAdapter` creation, initialization, and state management

**Runtime Data Flow**:
- **DAP Message Processing**: Bi-directional protocol handling between debugging client and Python debugpy adapter
- **State Management**: Event-driven transitions (UNINITIALIZED → READY/ERROR) with proper lifecycle cleanup
- **Process Orchestration**: Debugpy subprocess management with connection handling and error recovery

**Cross-Platform Support**:
- **Windows**: Support for standard Python, Windows Store Python, py launcher, and virtual environments
- **Unix-like Systems**: Standard installation detection with virtual environment awareness
- **Environment Variables**: `PYTHON_EXECUTABLE`, `pythonLocation` configuration support

## Important Patterns and Conventions

**Robust Environment Handling**: The module implements sophisticated Python discovery with multiple fallback strategies, comprehensive validation pipelines, and graceful degradation when dependencies are unavailable.

**Factory Pattern with Validation**: Clean separation between creation/validation concerns (factory) and runtime debugging operations (adapter), ensuring environment prerequisites are met before expensive debugging operations begin.

**Caching and Performance**: TTL-based caching (60s) for executable discovery, command resolution memoization, and environment validation caching to optimize repeated operations.

**Comprehensive Error Handling**: Custom exception types, detailed error reporting with context, and user-friendly error messages for common configuration issues.

**Test-Driven Architecture**: Extensive mock-based testing covering cross-platform scenarios, error conditions, and edge cases, ensuring reliability across diverse development environments.

This module serves as a production-ready Python debugging solution that handles the complexity of Python environment management while providing a clean, standardized interface for debugging operations within the mcp-debugger ecosystem.