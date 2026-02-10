# tests/adapters/python/unit/
@generated: 2026-02-09T18:16:05Z

## Purpose
This directory contains comprehensive unit tests for the Python adapter utilities in the debugmcp ecosystem. It validates cross-platform Python executable discovery, version detection, and command resolution functionality that enables the adapter to reliably locate and interact with Python installations across different operating systems.

## Key Components and Organization

### Core Test Coverage
- **Python Executable Discovery**: Tests the complex logic for finding Python installations across Windows, Linux, and macOS platforms
- **Version Detection**: Validates parsing of Python version information from various output formats and edge cases  
- **Command Resolution**: Tests the configurable command finding infrastructure that underlies Python executable discovery
- **Cross-Platform Compatibility**: Ensures consistent behavior across different operating systems and Python installation patterns

### Test Infrastructure Architecture
The test suite employs sophisticated mocking strategies to simulate real-world scenarios:

- **Partial Child Process Mocking**: Mocks `spawn` while preserving other child_process APIs to avoid breaking cleanup operations
- **Event-Driven Simulation**: Uses EventEmitter patterns to simulate asynchronous process spawning and completion
- **Platform Abstraction**: Leverages `describe.each` for systematic cross-platform testing without code duplication
- **Environment Isolation**: Comprehensive cleanup of Python-related environment variables prevents test interference

### Platform-Specific Logic Testing
Tests validate the adapter's ability to handle:
- **Windows Store Python aliases** and their validation mechanisms
- **GitHub Actions environment** variables like `pythonLocation`
- **Platform-specific command precedence** (e.g., `py` on Windows, `python3` on Unix)
- **Environment variable hierarchies** (user paths, PYTHON_PATH, PYTHON_EXECUTABLE)

## Public API Surface
The tests validate the following key entry points from the adapter-python package:

- `findPythonExecutable()`: Core function for locating Python installations with fallback logic
- `getPythonVersion()`: Utility for extracting version information from Python executables
- `setDefaultCommandFinder()`: Configuration interface for customizing command resolution behavior

## Data Flow and Integration Patterns
The test suite validates a layered approach to Python discovery:

1. **User Override Layer**: Tests explicit Python path specifications
2. **Environment Variable Layer**: Validates PYTHON_PATH and PYTHON_EXECUTABLE resolution
3. **Auto-Detection Layer**: Tests platform-specific command search patterns
4. **Fallback Layer**: Ensures graceful degradation when preferred options fail
5. **Error Handling Layer**: Validates appropriate responses to missing executables or spawn failures

## Critical Testing Patterns
- **Mock Lifecycle Management**: Proper setup/teardown prevents state pollution between tests
- **Async Process Simulation**: Event-based mocks simulate real spawn timing and error conditions
- **Platform Stubbing**: Global platform detection overrides ensure consistent test execution
- **Error Propagation Validation**: Tests both wrapped exceptions and null return scenarios

This test directory serves as the quality gate ensuring the Python adapter can reliably bootstrap Python environments across diverse deployment scenarios, from developer workstations to CI/CD pipelines and production containers.