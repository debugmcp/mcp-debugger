# packages/adapter-python/src/
@generated: 2026-02-10T21:27:09Z

## Purpose
This directory implements a complete Python debugging adapter for the mcp-debugger framework, providing a bridge between the Debug Adapter Protocol (DAP) and Python's debugpy debugging infrastructure. It handles Python environment detection, debugpy integration, and manages the full lifecycle of Python debugging sessions.

## Key Components and Integration

### Core Architecture
The module follows a three-layer architecture:

1. **Factory Layer** (`PythonAdapterFactory`): Creates and validates Python debug adapter instances using dependency injection patterns
2. **Adapter Layer** (`PythonDebugAdapter`): Main implementation providing DAP protocol operations, session management, and Python-specific debugging capabilities  
3. **Utilities Layer** (`utils/`): Cross-platform Python executable discovery, environment validation, and debugpy integration

### Component Relationships
- **PythonAdapterFactory** orchestrates adapter creation and performs comprehensive environment validation before instantiation
- **PythonDebugAdapter** manages debug session lifecycle, implements DAP protocol operations, and maintains connection state with debugpy
- **Python Utils** provide the foundation for executable discovery, version checking, and debugpy availability validation across platforms

The components work together through a validation-first approach: the factory validates the Python environment (Python 3.7+, debugpy availability) before creating adapter instances that rely on these validated resources.

## Public API Surface

### Main Entry Points (`index.ts`)
- **PythonAdapterFactory**: Primary factory for creating Python debug adapters
- **PythonDebugAdapter**: Core adapter implementation for debugging sessions
- **findPythonExecutable**: Cross-platform Python executable discovery
- **getPythonVersion**: Python version extraction utility
- **setDefaultCommandFinder**: Configuration point for custom command resolution
- **CommandNotFoundError**: Structured error handling for missing executables

### Factory Interface (`IAdapterFactory`)
- `createAdapter()`: Instantiates new Python debug adapters
- `validate()`: Comprehensive environment validation with detailed error reporting
- `getMetadata()`: Returns adapter metadata including supported file extensions (.py, .pyw)

### Debug Adapter Interface (`IDebugAdapter`)
- `initialize()`: Environment validation and state transitions
- `connect()/disconnect()`: debugpy connection lifecycle management
- `sendDapRequest()`: DAP protocol message handling with Python-specific validation
- `getCapabilities()`: Returns comprehensive debugging capabilities (breakpoints, exception handling, variable inspection)

## Internal Organization and Data Flow

### Environment Detection Flow
1. **Discovery**: Uses platform-specific strategies to locate Python executables
2. **Validation**: Tests executables for functionality, version compatibility (≥3.7), and debugpy availability
3. **Caching**: Maintains TTL-based cache (60 seconds) for performance optimization
4. **Selection**: Prioritizes debugpy-enabled Python installations

### Debug Session Flow
1. **Factory Validation**: Pre-flight checks for Python environment and debugpy
2. **Adapter Creation**: Instantiation with validated dependencies
3. **Session Initialization**: Environment setup and capability negotiation
4. **Protocol Handling**: DAP request/response processing with Python-specific transformations
5. **Connection Management**: debugpy adapter command execution and communication

## Important Patterns and Conventions

### Cross-Platform Compatibility
- Sophisticated Windows Store Python alias detection and filtering
- Platform-specific executable search paths and naming conventions
- Environment variable normalization across different shell environments

### Robust Error Handling
- Multi-layered validation with graceful degradation
- Structured error types with detailed diagnostic information
- Comprehensive logging support with CI-aware output

### Performance Optimization
- TTL-based caching for expensive operations (executable discovery, version checking)
- Lazy evaluation of debugpy availability checking
- Efficient subprocess spawning for validation tasks

### State Management
- Event-driven state transitions using `AdapterState` enum
- Thread-safe caching mechanisms
- Connection state tracking with proper cleanup

This module serves as the complete Python debugging solution within the mcp-debugger ecosystem, providing reliable cross-platform Python debugging with modern toolchain compatibility and comprehensive error handling.