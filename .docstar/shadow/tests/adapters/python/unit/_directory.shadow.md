# tests\adapters\python\unit/
@generated: 2026-02-12T21:05:40Z

## Overall Purpose
This directory contains unit tests for the Python adapter's core utility functions within the debugmcp system. It focuses on testing cross-platform Python executable discovery, version detection, and command resolution functionality that enables the adapter to locate and interact with Python installations across Windows, Linux, and macOS environments.

## Key Components and Organization

### Test Coverage Areas
- **Python Executable Discovery**: Comprehensive testing of `findPythonExecutable()` with platform-specific command prioritization and environment variable handling
- **Version Detection**: Testing of `getPythonVersion()` for extracting Python version information from subprocess output
- **Command Finder Configuration**: Testing of `setDefaultCommandFinder()` for global command discovery configuration
- **Cross-Platform Compatibility**: Extensive platform-specific testing for Windows, Linux, and macOS behavior differences

### Mock Infrastructure
- **Process Mocking**: Sophisticated child_process mocking that preserves `exec` while providing controlled `spawn` behavior
- **Environment Management**: Comprehensive environment variable save/restore mechanisms to prevent test pollution
- **MockCommandFinder Integration**: Utilizes shared test utilities for simulating command discovery scenarios
- **Platform Simulation**: Configurable mock responses that simulate different operating system behaviors

## Testing Patterns and Conventions

### Cross-Platform Testing Strategy
- **Platform-specific prioritization**: Windows (`py -> python -> python3`) vs Unix (`python3 -> python`)
- **Environment variable precedence**: Tests hierarchy of PYTHON_PATH > PYTHON_EXECUTABLE > platform defaults
- **Windows Store alias handling**: Special validation to reject Windows Store Python aliases
- **GitHub Actions compatibility**: Specific handling for pythonLocation environment variables

### Error Handling and Fallback Testing
- **Command cascade testing**: Validates fallback through multiple Python executable candidates
- **Spawn error simulation**: Tests behavior when subprocess creation fails
- **Version parsing resilience**: Tests handling of malformed or missing version output
- **Graceful degradation**: Ensures system continues functioning when optimal Python not found

## Public API Surface
The tests validate the adapter's primary Python utility functions:
- `findPythonExecutable()`: Core function for locating Python installations
- `getPythonVersion()`: Version detection and parsing functionality
- `setDefaultCommandFinder()`: Global command discovery configuration

## Internal Data Flow
Tests validate the complete flow from environment analysis → command discovery → executable validation → version detection, ensuring robust Python environment detection across diverse deployment scenarios.

## Integration Points
- **MockCommandFinder**: Shared testing utility for command discovery simulation
- **debugmcp adapter-python**: Core module under test
- **vitest framework**: Comprehensive testing with advanced mocking capabilities
- **Cross-platform node.js APIs**: File system and process management testing