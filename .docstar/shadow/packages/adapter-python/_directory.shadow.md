# packages\adapter-python/
@children-hash: c0d71bb7a1225c58
@generated: 2026-02-24T01:54:57Z

## Overall Purpose

The `packages/adapter-python` directory implements a complete Python debugging adapter for the MCP debugger ecosystem. This adapter bridges Python debugging capabilities with the VSCode Debug Adapter Protocol (DAP), providing seamless integration with debugpy for Python development workflows within the broader MCP debugger framework.

## Component Architecture

### Core Components
- **PythonDebugAdapter**: The main adapter class implementing the `IDebugAdapter` interface, handling DAP protocol operations, debugpy integration, and debug session lifecycle management
- **PythonAdapterFactory**: Factory implementation that validates Python environments and creates adapter instances with proper dependency injection
- **Python Discovery System** (`utils/`): Cross-platform Python executable discovery with intelligent environment detection, debugpy availability checking, and performance optimization through caching

### Configuration and Build System
- **TypeScript Build Pipeline**: ES module configuration with monorepo structure, extending shared build configurations and enabling incremental compilation
- **Testing Infrastructure**: Comprehensive Vitest-based test suite covering unit tests, cross-platform compatibility, and integration scenarios
- **Package Configuration**: NPM package setup with workspace dependencies and peer dependency constraints for version compatibility

## Public API Surface

### Main Entry Points
- `PythonDebugAdapter`: Core debugging adapter with full DAP protocol support
- `PythonAdapterFactory`: Factory for creating validated adapter instances
- `findPythonExecutable()`: Primary utility for cross-platform Python discovery
- `getPythonVersion()`: Python version extraction and validation

### Configuration Support
- `PythonLaunchConfig`: Extended launch configuration supporting Python-specific debugging options (Django/Flask, subprocess debugging, module execution)
- Environment variable precedence handling (`PYTHON_EXECUTABLE`, `pythonLocation`, `PYTHON_PATH`)

## Internal Organization and Data Flow

### Initialization Flow
1. **Environment Discovery**: Multi-source Python executable detection with platform-specific optimizations
2. **Validation Pipeline**: Python version checking (3.7+ requirement), debugpy availability verification
3. **Factory Creation**: PythonAdapterFactory validates environment and creates adapter instances
4. **Adapter Initialization**: Debug adapter setup with cached dependencies and state management

### Debug Session Management
1. **Configuration Transform**: Generic launch configs converted to Python-specific debugpy configurations
2. **Command Building**: Platform-appropriate debugpy command construction with environment variables
3. **DAP Protocol Handling**: Request validation, event emission, and capability reporting
4. **Lifecycle Management**: Thread tracking, connection status, and cleanup procedures

### Discovery and Caching Strategy
- **Multi-source Discovery**: Preferred paths → environment variables → system PATH detection
- **Platform-aware Validation**: Windows Store alias filtering, executable testing, virtual environment support
- **Performance Optimization**: TTL-based caching (60s) with dependency injection for testability

## Important Patterns and Conventions

### Architectural Patterns
- **Factory Pattern**: Clean separation of environment validation from adapter creation
- **Strategy Pattern**: Pluggable command resolution system with mock support for testing
- **State Machine**: Adapter lifecycle with clear transitions (UNINITIALIZED → READY → ERROR)
- **Dependency Injection**: Configurable command finders and environment utilities

### Error Handling and Robustness
- **Graceful Degradation**: Distinguishes between hard failures (missing Python) and warnings (missing debugpy)
- **Comprehensive Validation**: Structured error reporting with user-friendly message translation
- **Cross-platform Compatibility**: Robust handling of Windows Store aliases, virtual environments, and PATH resolution

### Testing Strategy
- **Multi-layered Testing**: Smoke tests, unit tests, integration tests, and cross-platform validation
- **Mock Infrastructure**: Standardized dependency creation and platform simulation
- **Real-world Scenarios**: Coverage of actual deployment edge cases and failure modes

## Integration with MCP Ecosystem

This adapter serves as a critical component in the MCP debugger framework, providing:
- **Protocol Compliance**: Full DAP protocol implementation for Python debugging
- **Shared Utilities**: Integration with `@debugmcp/shared` package for common debugging infrastructure
- **Monorepo Architecture**: Workspace-linked dependencies with consistent build and testing patterns
- **Extensible Design**: Factory pattern enables environment-specific adapter creation and validation

The adapter enables reliable Python debugging across diverse development environments while maintaining consistent integration with the broader MCP debugger ecosystem through standardized interfaces and shared architectural patterns.