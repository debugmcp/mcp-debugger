# packages/adapter-python/src/
@generated: 2026-02-09T18:16:38Z

## Overall Purpose and Responsibility

The `packages/adapter-python/src` directory implements a complete Python debugging adapter for the DebugMCP ecosystem. This module provides Node.js-based Python debugging capabilities by integrating with Python's `debugpy` module and translating between DAP (Debug Adapter Protocol) messages and Python-specific debugging operations.

## Key Components and Relationships

### Core Architecture Layers

**Factory Layer** (`python-adapter-factory.ts`)
- Implements the factory pattern for adapter instantiation
- Handles environment validation and dependency checking
- Ensures Python ≥3.7 and debugpy availability before adapter creation
- Returns adapter metadata including supported file extensions and capabilities

**Adapter Implementation** (`python-debug-adapter.ts`) 
- Main debugging logic extending EventEmitter and implementing IDebugAdapter
- Manages complete debugging lifecycle from initialization to termination
- Handles state transitions, caching, and DAP protocol translation
- Provides Python-specific configuration transformations and error handling

**Utility Layer** (`utils/`)
- Cross-platform Python executable discovery and validation
- Environment detection with Windows Store alias filtering
- Version checking and debugpy module availability testing
- Robust error handling with comprehensive fallback mechanisms

### Component Integration Flow

1. **Discovery Phase**: Utilities locate and validate Python installations
2. **Factory Phase**: Factory validates environment and creates adapter instances
3. **Runtime Phase**: Adapter manages debugging sessions with Python processes
4. **Interface Phase**: Entry point provides clean public API access

## Public API Surface

### Main Entry Points (index.ts)

**Core Adapters**
- `PythonAdapterFactory` - Factory for creating Python debug adapter instances
- `PythonDebugAdapter` - Main debugging adapter implementation

**Environment Utilities**
- `findPythonExecutable(preferredPath?, logger?)` - Multi-stage Python discovery
- `getPythonVersion(pythonPath)` - Version extraction from Python executables
- `setDefaultCommandFinder(finder)` - Configure custom executable location strategy

**Error Handling**
- `CommandNotFoundError` - Exception for missing Python executables

**Type Definitions**
- `CommandFinder` - Interface for custom executable location logic

### Configuration Interfaces

- `PythonLaunchConfig` - Python-specific debugging configuration with framework support (Django, Flask)
- Environment variable support: `PYTHON_PATH`, `PYTHON_EXECUTABLE`, `pythonLocation`
- Debug mode activation via `DEBUG_PYTHON_DISCOVERY`

## Internal Organization and Data Flow

### Validation Pipeline
1. **Environment Detection**: Multi-platform Python executable discovery
2. **Version Validation**: Python 3.7+ requirement enforcement  
3. **Dependency Verification**: debugpy module availability confirmation
4. **Adapter Creation**: Factory instantiation with validated environment

### Caching Strategy
- 60-second TTL cache for Python executable paths and metadata
- Set-based deduplication for discovered Python candidates
- Performance optimization for repeated environment lookups

### State Management
- Formal state machine: UNINITIALIZED → INITIALIZING → READY → CONNECTED → DEBUGGING
- Event-driven architecture with state transition notifications
- Thread ID tracking for active debugging sessions

## Important Patterns and Conventions

### Cross-Platform Compatibility
- Windows-specific handling for py launcher and Store aliases  
- Platform-aware search paths for Python installations
- ComSpec fallback mechanisms for Windows process spawning

### Error Recovery and Diagnostics
- Multi-stage fallback mechanisms prevent total discovery failure
- Comprehensive error reporting with attempted paths and suggestions
- User-friendly error messages for common installation issues

### Dependency Injection
- Factory pattern with configurable dependencies
- CommandFinder abstraction for testable executable discovery
- Logger interface abstraction for flexible logging backends

### Protocol Integration
- DAP message translation for Python debugging operations
- Python-specific exception breakpoint filters
- Framework-aware debugging support (Django, Flask, Jinja)

This module serves as a critical bridge between Node.js debugging clients and Python runtime environments, providing robust, cross-platform Python debugging capabilities with comprehensive environment validation and error recovery.