# packages\adapter-python/
@children-hash: 8757410941e6ebab
@generated: 2026-02-23T15:27:03Z

## Overall Purpose
The `packages/adapter-python` directory implements a complete Python debugging adapter for the MCP debugger system. It provides Python-specific debugging capabilities through the Debug Adapter Protocol (DAP), handling Python environment discovery, validation, debugpy integration, and debug session management across multiple platforms.

## Key Components and Integration

### Core Architecture
The module follows a layered factory pattern architecture:

**Adapter Layer (`src/`)**
- **PythonDebugAdapter**: Main adapter implementing `IDebugAdapter` interface for Python debugging sessions
- **PythonAdapterFactory**: Factory with environment validation creating adapter instances
- **index.ts**: Centralized entry point exposing public API

**Utility Layer (`src/utils/`)**
- **python-utils.ts**: Cross-platform Python executable discovery with Windows Store alias filtering
- **CommandFinder**: Pluggable command resolution with TTL-based caching

**Test Infrastructure (`tests/`)**
- Comprehensive test suite covering unit tests, cross-platform compatibility, and edge cases
- Mock factories and environment simulation for reliable testing

**Configuration (`vitest.config.ts`)**
- Test framework setup with TypeScript support and monorepo workspace aliases

### Component Interaction Flow
1. **Discovery Phase**: Python utilities scan system for valid Python executables with debugpy support
2. **Validation Phase**: Factory validates Python version (3.7+) and debugpy availability
3. **Instantiation Phase**: Factory creates configured PythonDebugAdapter instances
4. **Debug Session Phase**: Adapter manages DAP protocol operations and debugpy integration

## Public API Surface

### Main Entry Points
- `PythonDebugAdapter`: Core debug adapter with full DAP protocol support
- `PythonAdapterFactory`: Factory for adapter creation with environment validation
- `findPythonExecutable()`: Primary Python executable discovery utility
- `getPythonVersion()`: Python version extraction utility
- `PythonLaunchConfig`: Extended configuration for Python-specific debugging options

### Configuration Interface
- Django/Flask debugging support
- Subprocess debugging capabilities
- Module execution options
- Virtual environment handling

## Internal Organization and Data Flow

### Initialization Pipeline
1. **Multi-source Discovery**: Checks preferred paths → environment variables → system detection
2. **Platform-aware Validation**: Windows Store filtering, executable testing, debugpy verification
3. **Caching Layer**: 60-second TTL caching for performance optimization
4. **Factory Validation**: Environment checking with structured error/warning reporting

### Debug Session Management
- Configuration transformation from generic to Python-specific formats
- Platform-appropriate debugpy command construction
- DAP request validation and event handling
- Thread tracking and connection state management

## Important Patterns and Conventions

### Architectural Patterns
- **Factory Pattern**: Clean separation of validation logic and adapter creation
- **Strategy Pattern**: Pluggable command resolution for different environments
- **State Machine**: Lifecycle management with event emission (UNINITIALIZED → READY → ERROR)
- **Caching Strategy**: Performance optimization with TTL-based executable discovery

### Cross-Platform Compatibility
- Windows-specific optimizations (Store Python handling, .exe extensions)
- Unix-like system support (Linux, macOS PATH resolution)
- Virtual environment detection and preference
- Robust fallback strategies for diverse deployment scenarios

### Error Handling Philosophy
- Distinction between blocking errors (missing Python) and warnings (missing debugpy)
- Graceful degradation through multiple discovery strategies
- User-friendly error message translation from low-level Python errors
- Comprehensive test coverage for edge cases and failure modes

The module serves as the critical bridge between the MCP debugger system and Python development environments, providing reliable environment detection, comprehensive DAP protocol support, and seamless debugpy integration for Python debugging workflows.