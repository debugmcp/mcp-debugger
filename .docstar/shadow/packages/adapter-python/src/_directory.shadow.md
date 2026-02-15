# packages\adapter-python\src/
@children-hash: 10c6608c9801779a
@generated: 2026-02-15T09:01:41Z

## Purpose
The `adapter-python` source module provides a complete Python debugging adapter implementation for the mcp-debugger framework. It enables Python debugging capabilities through debugpy integration, offering robust environment detection, configuration management, and DAP (Debug Adapter Protocol) compliance for Python debugging sessions.

## Key Components and Architecture

### Core Adapter Implementation
- **PythonDebugAdapter**: Main adapter class implementing `IDebugAdapter` interface, managing Python debugging sessions with state tracking, connection lifecycle, and comprehensive DAP protocol operations
- **PythonAdapterFactory**: Factory implementation following dependency injection pattern for creating and validating Python debug adapter instances

### Environment Discovery System
- **Utils Module**: Sophisticated cross-platform Python executable discovery with Windows Store alias filtering, virtual environment detection, and debugpy-aware selection
- **Multi-layered Discovery**: Priority-based detection using preferred paths, environment variables, and auto-detection with comprehensive fallback mechanisms

### Configuration Management
- **PythonLaunchConfig**: Extended launch configuration supporting Python-specific options including module execution, Django/Flask frameworks, console types, and subprocess debugging
- **Environment Validation**: Comprehensive validation checking Python 3.7+ requirement and debugpy installation availability

## Public API Surface

### Primary Entry Points
- **index.ts**: Centralized export interface providing access to all public components
  - `PythonDebugAdapter` and `PythonAdapterFactory` classes
  - `findPythonExecutable`, `getPythonVersion` utility functions
  - `CommandFinder` type definition and `CommandNotFoundError` exception

### Factory Interface
- `createAdapter()`: Instantiates new Python debug adapter instances
- `getMetadata()`: Returns adapter metadata including language info, supported file extensions (.py, .pyw), and embedded SVG icon
- `validate()`: Performs comprehensive environment validation with detailed error/warning reporting

### Adapter Interface
- Implements full `IDebugAdapter` interface with Python-specific behavior
- DAP protocol operations with Python-specific request validation
- Connection management and debugging session lifecycle
- Comprehensive capability reporting including breakpoints, exception handling, and variable inspection

## Internal Organization and Data Flow

### Initialization Flow
1. Factory validation checks Python environment and debugpy availability
2. Adapter initialization resolves Python executable with TTL-based caching
3. Environment detection uses platform-specific search strategies
4. Connection establishment prepares debugpy adapter commands

### Runtime Architecture
- **State Management**: Adapter lifecycle tracking with event emission
- **Caching Strategy**: 60-second TTL cache for Python executable resolution and metadata
- **Command Building**: Platform-appropriate debugpy command construction
- **Error Translation**: Converts low-level Python errors to user-friendly messages

### Discovery Pipeline
1. Multi-priority discovery evaluates preferred paths, environment variables, and auto-detection
2. Candidate validation filters Windows Store aliases and validates executables
3. Debugpy capability assessment prioritizes development-friendly installations
4. Result caching optimizes performance for repeated operations

## Important Patterns and Conventions

### Design Patterns
- **Factory Pattern**: Clean adapter instantiation with validation
- **Strategy Pattern**: Pluggable command resolution via CommandFinder interface
- **Template Method**: IDebugAdapter implementation with Python-specific behavior
- **Graceful Degradation**: Multiple fallback paths ensure robust operation

### Platform Awareness
- Windows-specific handling including Store alias detection and py launcher support
- Cross-platform executable discovery with platform-appropriate search paths
- Environment variable-controlled verbose logging for troubleshooting

### Critical Constraints
- Requires Python 3.7+ for operation
- Depends on debugpy module availability in target Python environment
- Thread safety considerations for concurrent cache access
- Platform-specific naming conventions and executable search strategies

The module serves as a comprehensive Python debugging solution, providing reliable environment detection, robust configuration management, and full DAP protocol compliance while maintaining cross-platform compatibility and development-friendly defaults.