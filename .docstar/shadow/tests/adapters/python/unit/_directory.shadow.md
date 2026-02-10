# tests/adapters/python/unit/
@generated: 2026-02-10T21:26:22Z

## Purpose
Unit test suite for the Python adapter utilities in the debugmcp system. This directory contains comprehensive test coverage for Python executable discovery, version detection, and command finding functionality across multiple platforms (Windows, Linux, macOS).

## Key Components and Organization

### Core Test Suite: python-utils.test.ts
The primary test file providing comprehensive coverage of Python utility functions with:
- **Cross-platform testing**: Validates behavior across win32, linux, and darwin platforms
- **Python executable discovery**: Tests fallback strategies from user-specified paths to environment variables to system commands
- **Version detection**: Validates Python version extraction from stdout/stderr output
- **Command finder configuration**: Tests dependency injection for command discovery

## Test Architecture

### Mock Infrastructure
- **Process Mocking**: EventEmitter-based child_process simulation for testing async spawn operations
- **Platform Isolation**: Global stubbing mechanism for testing platform-specific logic without OS dependencies  
- **Command Discovery**: MockCommandFinder for testing command resolution strategies
- **Environment Management**: Systematic cleanup of Python-related environment variables between tests

### Test Patterns
- **Parameterized Testing**: Uses describe.each for running identical test logic across multiple platforms
- **Fallback Chain Testing**: Validates progressive fallback from preferred to available Python executables
- **Error Condition Testing**: Comprehensive coverage of failure scenarios including missing executables and spawn errors

## Test Coverage Areas

### Platform-Specific Behavior
- **Windows**: py launcher priority, Microsoft Store alias detection, where.exe command resolution
- **Unix-like systems**: python3 → python fallback ordering, which command usage
- **Cross-platform**: Environment variable precedence (PYTHON_PATH, PYTHON_EXECUTABLE, pythonLocation)

### Core Functionality Testing
- **findPythonExecutable**: Multi-stage discovery process with user preferences, environment variables, and system fallbacks
- **getPythonVersion**: Version string extraction with robust parsing of both stdout and stderr output
- **setDefaultCommandFinder**: Global configuration for command discovery dependency injection

## Integration Points
- **Target Code**: Tests utilities from @debugmcp/adapter-python package
- **Error Handling**: Validates CommandNotFoundError and other adapter-specific exceptions
- **Test Utilities**: Leverages shared MockCommandFinder from test-utils for consistent mocking patterns

## Key Testing Strategies
- **Environment Isolation**: Systematic setup/teardown of environment variables and global state
- **Async Process Testing**: EventEmitter-based mocking for testing child process interactions
- **Error Simulation**: Comprehensive testing of failure modes including network issues, missing files, and invalid responses
- **Cross-Platform Validation**: Ensures Python discovery works consistently across different operating systems

This test suite ensures the Python adapter can reliably discover and interact with Python installations across diverse deployment environments while providing comprehensive error handling and fallback mechanisms.