# packages/adapter-python/
@generated: 2026-02-09T18:16:54Z

## Overall Purpose and Responsibility

The `packages/adapter-python` directory implements a complete Python debugging adapter package for the DebugMCP ecosystem. This module provides Node.js-based Python debugging capabilities by integrating with Python's `debugpy` module and translating between DAP (Debug Adapter Protocol) messages and Python-specific debugging operations. It serves as a critical bridge between Node.js debugging clients and Python runtime environments.

## Key Components and Integration

### Core Architecture
The package follows a layered architecture with clear separation of concerns:

**Factory Layer** (`src/python-adapter-factory.ts`)
- Implements factory pattern for safe adapter instantiation
- Validates Python ≥3.7 and debugpy availability before creation
- Provides adapter metadata and capability information

**Adapter Implementation** (`src/python-debug-adapter.ts`)
- Main debugging logic extending EventEmitter and implementing IDebugAdapter
- Manages complete debugging lifecycle with formal state machine
- Handles DAP protocol translation and Python-specific configurations

**Utility Layer** (`src/utils/`)
- Cross-platform Python executable discovery and validation
- Environment detection with comprehensive fallback mechanisms
- Version checking and dependency verification

**Public API** (`src/index.ts`)
- Clean entry point exposing core classes and utilities
- Type definitions and error handling interfaces

### Component Integration Flow
1. **Environment Discovery**: Utilities locate and validate Python installations across platforms
2. **Factory Validation**: Factory verifies environment compatibility and dependencies
3. **Adapter Creation**: Factory instantiates adapters with validated Python environments  
4. **Debug Session Management**: Adapter handles debugging lifecycle with state tracking
5. **Protocol Translation**: DAP messages translated for Python debugging operations

## Public API Surface

### Main Entry Points

**Core Classes**
- `PythonAdapterFactory` - Primary factory for creating Python debug adapter instances
- `PythonDebugAdapter` - Main debugging adapter implementation with full DAP support

**Environment Utilities** 
- `findPythonExecutable(preferredPath?, logger?)` - Multi-stage Python discovery with caching
- `getPythonVersion(pythonPath)` - Version extraction and validation
- `setDefaultCommandFinder(finder)` - Configurable executable location strategy

**Configuration & Types**
- `PythonLaunchConfig` - Python-specific debugging configuration with framework support
- `CommandFinder` - Interface for custom executable discovery
- `CommandNotFoundError` - Specialized exception for missing executables

### Configuration Support
- Environment variables: `PYTHON_PATH`, `PYTHON_EXECUTABLE`, `pythonLocation`
- Framework-specific debugging: Django, Flask, Jinja templates
- Debug mode activation via `DEBUG_PYTHON_DISCOVERY`

## Internal Organization and Data Flow

### Multi-Stage Discovery Pipeline
1. **Preferred Path Resolution**: User-specified or environment variable paths
2. **Platform-Specific Discovery**: Windows py launcher, Unix PATH scanning
3. **Validation & Filtering**: Version checking, Windows Store alias filtering
4. **Caching Strategy**: 60-second TTL cache with deduplication

### State Management Architecture
- Formal state machine: UNINITIALIZED → INITIALIZING → READY → CONNECTED → DEBUGGING
- Event-driven transitions with comprehensive error handling
- Thread ID tracking for active debugging sessions

### Cross-Platform Compatibility
- Windows-specific handling for py launcher and Store Python aliases
- Platform-aware search paths and process spawning
- ComSpec fallback mechanisms for Windows environments

## Testing Infrastructure

### Comprehensive Test Coverage
- **Package-Level Validation** (`tests/python-adapter.test.ts`) - Public API smoke tests
- **Unit Testing** (`tests/unit/`) - Component-level testing with extensive mocking
- **Vitest Configuration** (`vitest.config.ts`) - Test environment setup with workspace aliasing

### Testing Strategy
- Mock-based testing for Python processes and filesystem operations
- Cross-platform testing via platform simulation
- Environment validation across diverse Python configurations
- Lifecycle testing from initialization through disposal

## Important Patterns and Conventions

### Robustness & Error Recovery
- Multi-stage fallback mechanisms prevent total discovery failure
- Comprehensive error reporting with actionable suggestions
- Graceful degradation for partial environment failures

### Performance Optimization
- Intelligent caching with TTL for expensive operations
- Set-based deduplication for discovered candidates
- Lazy initialization patterns for resource management

### Developer Experience
- User-friendly error messages for common installation issues
- Comprehensive logging with CI environment detection
- Framework-aware debugging capabilities for popular Python web frameworks

This package provides a production-ready Python debugging solution with excellent cross-platform compatibility, robust error handling, and comprehensive environment validation, making it suitable for diverse development environments and CI/CD pipelines.