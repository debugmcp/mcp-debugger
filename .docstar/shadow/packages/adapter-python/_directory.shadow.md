# packages/adapter-python/
@generated: 2026-02-10T01:20:18Z

## Overall Purpose

The `packages/adapter-python` directory implements a complete Python debugging adapter for the mcp-debugger framework. It serves as a bridge between the Debug Adapter Protocol (DAP) and Python's debugpy debugging infrastructure, enabling seamless Python debugging experiences across different development environments and platforms.

## Key Components and Integration

### Core Architecture
The package follows a layered architecture with clear separation of concerns:

- **`src/`**: Complete implementation providing the adapter factory, debug adapter, and cross-platform Python environment utilities
- **`tests/`**: Comprehensive test suite validating functionality across diverse environments
- **`vitest.config.ts`**: Test configuration enabling proper TypeScript module resolution and workspace integration

### Component Integration Flow

1. **Environment Discovery**: The `src/utils/` utilities discover and validate Python installations across platforms, implementing platform-specific optimizations for Windows, Linux, and macOS
2. **Factory Pattern**: `PythonAdapterFactory` creates validated adapter instances using comprehensive environment validation
3. **Session Management**: `PythonDebugAdapter` manages debugging sessions, translating between DAP and debugpy protocols while maintaining state
4. **Validation & Testing**: The test suite ensures reliability across Python versions, virtual environments, and platform configurations

## Public API Surface

### Primary Entry Points
- **`PythonAdapterFactory`**: Main factory implementing `IAdapterFactory` interface for adapter creation with environment validation
- **`PythonDebugAdapter`**: Core adapter managing Python debugging sessions and DAP protocol handling  
- **`findPythonExecutable()`**: Cross-platform Python executable discovery utility

### Configuration & Utilities
- **`PythonLaunchConfig`**: Python-specific debugging configuration interface
- **`CommandFinder`**: Pluggable command discovery strategy interface
- **`CommandNotFoundError`**: Exception handling for missing Python installations
- **`getPythonVersion()`**: Python version detection and validation
- **`setDefaultCommandFinder()`**: Configuration for custom command discovery

## Internal Organization and Data Flow

### Environment Validation Pipeline
1. **Multi-strategy Discovery**: Searches environment variables, system paths, and fallback locations
2. **Comprehensive Validation**: Tests Python version (>=3.7), debugpy availability, and filters Windows Store aliases
3. **Performance Optimization**: TTL-based caching (60 seconds) of validated environments
4. **Platform Adaptation**: Handles Windows-specific paths, Unix PATH resolution, and virtual environment detection

### Debugging Session Lifecycle
1. **Factory Creation**: Environment validation and adapter instantiation
2. **Session Initialization**: Configuration transformation and DAP connection establishment
3. **Protocol Management**: Request/response handling with Python-specific validation
4. **State Management**: Lifecycle tracking using `AdapterState` enum with event emission
5. **Cleanup**: Resource disposal and cache management

## Important Patterns and Conventions

### Architectural Patterns
- **Factory Pattern**: Centralized adapter creation with dependency injection
- **Strategy Pattern**: Pluggable command discovery for testing and customization  
- **Caching Pattern**: Performance optimization through environment validation caching
- **State Machine**: Managed lifecycle transitions with comprehensive event emission

### Cross-Platform Reliability
- **Platform-Specific Handling**: Windows Store filtering, ComSpec fallbacks, and path normalization
- **Environment Detection**: Automatic virtual environment discovery and handling
- **Progressive Fallback**: Multiple discovery strategies prevent total failure
- **Error Reporting**: User-friendly diagnostics with actionable guidance

### Testing Strategy
- **Smoke Tests**: Package-level validation of exports and basic instantiation
- **Comprehensive Unit Tests**: Full coverage of factory, adapter, and utility functions
- **Platform Simulation**: Mock-based testing across Windows, Linux, and macOS scenarios
- **Error Boundary Testing**: Validation of failure modes and graceful degradation

## Dependencies and Constraints

### External Requirements
- **Python 3.7+**: Minimum version for debugging functionality
- **debugpy package**: Required in target Python environment
- **DAP Protocol**: Full compliance with Debug Adapter Protocol specifications

### Performance Characteristics  
- **Caching Strategy**: 60-second TTL for executable resolution
- **Lazy Validation**: Environment checks occur only when needed
- **Concurrent Safety**: Thread-safe operations and state management

This package provides a production-ready Python debugging adapter with robust environment handling, comprehensive validation, and platform-aware implementation suitable for integration into diverse development tools and IDEs through the mcp-debugger ecosystem.