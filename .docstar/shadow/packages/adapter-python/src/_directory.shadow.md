# packages/adapter-python/src/
@generated: 2026-02-10T01:20:01Z

## Purpose

The `packages/adapter-python/src` directory provides the complete implementation of a Python debugging adapter for the mcp-debugger framework. It serves as a bridge between the Debug Adapter Protocol (DAP) and Python's debugpy debugging infrastructure, enabling seamless Python debugging experiences across different development environments and platforms.

## Key Components and Integration

### Core Architecture
The directory follows a layered architecture with clear separation of concerns:

- **Entry Point** (`index.ts`): Centralized export interface providing clean access to all public APIs
- **Factory Layer** (`python-adapter-factory.ts`): Implements the factory pattern for adapter creation with comprehensive environment validation
- **Adapter Implementation** (`python-debug-adapter.ts`): Core debugging session management with DAP protocol handling
- **Utilities** (`utils/`): Foundation layer for Python environment discovery and validation across platforms

### Component Interaction Flow

1. **Initialization**: The `PythonAdapterFactory` validates the Python environment using utilities from the `utils` directory
2. **Creation**: Factory creates `PythonDebugAdapter` instances with validated Python executable paths
3. **Session Management**: The adapter manages debugging sessions, leveraging cached Python environment information
4. **Protocol Handling**: Adapter translates between DAP requests and debugpy commands, maintaining session state

## Public API Surface

### Primary Entry Points
- **`PythonAdapterFactory`**: Main factory class implementing `IAdapterFactory` interface for adapter creation
- **`PythonDebugAdapter`**: Core adapter implementation managing Python debugging sessions
- **`findPythonExecutable()`**: Utility function for robust Python executable discovery across platforms

### Support Functions
- **`getPythonVersion()`**: Python version detection and validation
- **`setDefaultCommandFinder()`**: Configuration function for custom command discovery
- **`CommandNotFoundError`**: Exception handling for missing Python installations

### Type Definitions
- **`CommandFinder`**: Interface for pluggable command discovery strategies
- **`PythonLaunchConfig`**: Extended configuration interface for Python-specific debugging options

## Internal Organization and Data Flow

### Environment Discovery Pipeline
1. **Discovery**: Multi-strategy Python executable location (environment variables → system paths → fallbacks)
2. **Validation**: Comprehensive testing of discovered executables (version checks, debugpy availability, Windows Store alias filtering)
3. **Caching**: TTL-based caching of validated Python environments for performance optimization
4. **Selection**: Intelligent preference ordering favoring installations with debugging capabilities

### Debugging Session Lifecycle
1. **Validation**: Environment validation ensuring Python 3.7+ and debugpy availability
2. **Configuration**: Transformation of generic debug configurations to Python-specific launch configs
3. **Connection**: DAP session establishment with debugpy adapter command construction
4. **Protocol Management**: Request/response handling with Python-specific validation and state tracking
5. **Cleanup**: Session teardown with cache management and resource disposal

## Important Patterns and Conventions

### Platform-Specific Handling
- **Windows Optimizations**: Store alias filtering, path normalization, ComSpec fallback handling
- **Cross-Platform Consistency**: Unified command resolution and validation across operating systems
- **Virtual Environment Detection**: Automatic detection and handling of Python virtual environments

### Architectural Patterns
- **Factory Pattern**: Centralized adapter creation with dependency injection
- **Strategy Pattern**: Pluggable command finders for testing and customization
- **Caching Pattern**: Performance optimization through TTL-based executable path caching
- **State Machine**: Lifecycle management using `AdapterState` enum with event emission

### Error Handling Strategy
- **Progressive Fallback**: Multiple discovery strategies prevent total failure scenarios
- **Custom Error Types**: Specific exception classes for different failure modes
- **Validation-First**: All components validate inputs before processing
- **User-Friendly Diagnostics**: Clear error reporting with actionable guidance

## Critical Dependencies and Constraints

### External Dependencies
- **debugpy**: Python debugging infrastructure (required in target Python environment)
- **Python 3.7+**: Minimum version requirement for debugging functionality
- **DAP Protocol**: Compliance with Debug Adapter Protocol specifications

### Performance Characteristics
- **Caching Strategy**: 60-second TTL for Python executable resolution
- **Lazy Validation**: Environment validation occurs only when needed
- **Concurrent Safety**: Thread-safe cache access and session management

This directory represents a complete, production-ready Python debugging adapter with robust environment handling, comprehensive validation, and platform-aware implementation suitable for integration into the broader mcp-debugger ecosystem.