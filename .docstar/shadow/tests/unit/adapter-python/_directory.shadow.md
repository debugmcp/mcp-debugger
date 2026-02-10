# tests/unit/adapter-python/
@generated: 2026-02-10T01:19:35Z

## Python Debug Adapter Unit Tests

This directory contains comprehensive unit tests for the Python language debug adapter implementation. It validates the complete lifecycle and functionality of Python debugging capabilities within the larger debug adapter ecosystem.

### Overall Purpose

The test suite ensures the `PythonDebugAdapter` class correctly:
- Manages Python environment validation and dependency checking
- Transforms debug configurations for Python-specific requirements
- Handles DAP (Debug Adapter Protocol) communication and event processing
- Provides user-friendly error messages and installation guidance
- Maintains proper state transitions throughout debug sessions

### Key Test Components

#### Environment Management Testing
- **Python executable resolution**: Validates caching and path resolution logic
- **Version compatibility**: Ensures Python 3.7+ requirement enforcement
- **Dependency validation**: Tests debugpy installation detection in various environments
- **Virtual environment support**: Validates handling of Python virtual environments

#### DAP Protocol Integration Testing
- **Command generation**: Tests debugpy adapter command construction with proper arguments
- **Exception filtering**: Validates DAP exception breakpoint filter handling
- **Event processing**: Tests thread ID tracking and event transformation
- **Capabilities reporting**: Ensures correct DAP capability advertisement

#### Configuration & Lifecycle Testing
- **Launch configuration transformation**: Tests application of Python-specific defaults
- **Adapter initialization flow**: Validates environment setup and error state handling
- **Connection management**: Tests connect/disconnect state transitions
- **Resource cleanup**: Ensures proper disposal and state reset

#### User Experience Testing
- **Error translation**: Tests conversion of technical errors to user-friendly messages
- **Installation guidance**: Validates helper methods for dependency installation
- **Feature requirements**: Tests feature support detection and requirement descriptions

### Testing Architecture

The test suite employs several key patterns:
- **Dependency injection**: Uses factory pattern for creating standardized mock dependencies
- **Comprehensive mocking**: Isolates adapter logic from external dependencies (file system, processes, network)
- **State machine validation**: Tests adapter lifecycle state transitions
- **Event-driven testing**: Validates EventEmitter patterns and async communication

### Integration Points

This test directory validates the adapter's integration with:
- **Python runtime environment**: Executable detection, version checking, virtual environments
- **Debugpy debugger**: Installation detection, command generation, process management
- **DAP protocol**: Request/response handling, event processing, capability negotiation
- **Configuration system**: Launch config transformation and default value application

The tests ensure the Python debug adapter can reliably bridge between the generic debug adapter infrastructure and Python-specific debugging requirements, providing a robust and user-friendly debugging experience.