# packages\adapter-python\src/
@generated: 2026-02-12T21:01:15Z

## Purpose
The `packages/adapter-python/src` directory implements a comprehensive Python debugging adapter for the mcp-debugger framework. This module provides a complete solution for integrating Python debugging capabilities into the debugging ecosystem, handling everything from Python environment discovery and validation to DAP (Debug Adapter Protocol) communication and debugpy orchestration.

## Key Components & Architecture

### Core Adapter Implementation
- **`PythonDebugAdapter`**: The main adapter class implementing `IDebugAdapter` interface, managing Python debugging sessions, DAP protocol operations, and debugpy integration
- **`PythonAdapterFactory`**: Factory implementation for creating and validating Python debug adapter instances, ensuring proper environment setup before adapter creation

### Python Environment Management
The adapter includes sophisticated Python discovery and validation systems:
- **Cross-platform executable detection**: Supports Windows (including py launcher), macOS, and Linux Python installations
- **Virtual environment detection**: Automatically identifies and works within Python virtual environments
- **Version validation**: Enforces Python 3.7+ requirements with comprehensive version checking
- **Dependency verification**: Validates debugpy package availability before allowing debug sessions

### Utilities Infrastructure (`utils/`)
Provides foundational services for Python environment interaction:
- **Command resolution system**: Multi-strategy Python executable discovery with caching and platform-specific handling
- **Validation pipeline**: Comprehensive Python installation validation including Windows Store alias filtering
- **Error handling**: Custom exception types and graceful degradation strategies

## Public API Surface

### Main Entry Points (`index.ts`)
- **`PythonAdapterFactory`**: Primary factory for creating Python debug adapters
- **`PythonDebugAdapter`**: Core debugging adapter implementation
- **`findPythonExecutable()`**: Python executable discovery utility
- **`getPythonVersion()`**: Version extraction from Python installations
- **`CommandNotFoundError`**: Exception handling for missing commands

### Configuration & Extensibility
- **`PythonLaunchConfig`**: Extended configuration interface supporting Python-specific debugging options (Django/Flask, module execution, console types)
- **`CommandFinder`** interface: Pluggable command resolution strategy
- **`setDefaultCommandFinder()`**: Dependency injection for custom command discovery

## Internal Organization & Data Flow

### Initialization Flow
1. **Factory Creation**: `PythonAdapterFactory` validates Python environment during instantiation
2. **Environment Discovery**: Multi-tier Python executable search using utilities layer
3. **Validation Pipeline**: Comprehensive checks for Python version, debugpy availability, and installation validity
4. **Adapter Instantiation**: `PythonDebugAdapter` creation with validated environment

### Debug Session Management
1. **Connection Lifecycle**: Managed connection states with proper cleanup and disposal
2. **DAP Protocol Handling**: Bi-directional DAP message processing with Python-specific request validation
3. **Debugpy Integration**: Command construction and process management for debugpy adapter
4. **State Tracking**: Thread management, breakpoint handling, and session state maintenance

### Caching & Performance
- **Executable Path Caching**: TTL-based caching (60s) for Python executable resolution
- **Command Resolution Caching**: Optimized command discovery with result memoization
- **Environment Validation Caching**: Reduces redundant Python environment checks

## Important Patterns & Conventions

### Cross-Platform Compatibility
- Platform-specific Python executable search paths and naming conventions
- Windows Store Python alias detection and filtering
- Environment variable handling across different operating systems

### Dependency Injection & Factory Pattern
- Clean separation between factory (creation/validation) and adapter (runtime) responsibilities
- Pluggable command resolution through `CommandFinder` interface
- Configurable logging and diagnostic output

### Error Handling Strategy
- Comprehensive validation with both blocking errors and non-blocking warnings
- Graceful degradation through multiple discovery fallback strategies
- Detailed error reporting with context-appropriate messaging

### State Management
- Event-driven state transitions using `AdapterState` enum
- Proper lifecycle management with cleanup and disposal patterns
- Thread-safe caching mechanisms for concurrent access

This directory serves as a complete, production-ready Python debugging adapter that seamlessly integrates Python debugging capabilities into the mcp-debugger framework while handling the complexity of cross-platform Python environment management.