# tests\adapters\python\unit/
@children-hash: 7b0af12bfb834d8a
@generated: 2026-02-15T09:01:20Z

## Overall Purpose and Responsibility

This directory contains comprehensive unit tests for the Python adapter utilities within the debugmcp system. It validates cross-platform Python executable discovery, version detection, and command finder functionality that enables the debugger to locate and interact with Python interpreters across Windows, Linux, and macOS environments.

## Key Components and Organization

### Primary Test Suite: python-utils.test.ts
The single test file provides exhaustive coverage of Python utility functions with three main test categories:

1. **findPythonExecutable Tests** - Cross-platform Python interpreter discovery
2. **getPythonVersion Tests** - Python version extraction and parsing 
3. **setDefaultCommandFinder Tests** - Global command finder configuration

### Mock Infrastructure
- **Partial child_process mocking** - Preserves exec while mocking spawn for subprocess simulation
- **Environment variable management** - Safe save/restore of Python-related environment variables
- **MockCommandFinder integration** - Configurable command discovery simulation with call tracking
- **Process simulation** - EventEmitter-based mock processes for realistic testing

## Testing Patterns and Key Validation Points

### Cross-Platform Executable Discovery
- **Platform-specific command prioritization**: Windows (`py -> python -> python3`) vs Unix (`python3 -> python`)
- **Environment variable precedence**: User path > PYTHON_PATH > PYTHON_EXECUTABLE > platform defaults
- **Windows Store alias detection and rejection** - Validates against problematic Windows Store Python installations
- **Command fallback cascading** - Tests graceful degradation through available Python commands

### Version Detection and Error Handling
- **Multi-stream version parsing** - Handles Python version output on both stdout and stderr
- **Spawn error simulation** - Tests behavior when subprocess operations fail
- **Fallback mechanisms** - Ensures graceful handling when version patterns don't match

### Environment Isolation
- **Cross-test pollution prevention** - Proper cleanup of environment variables and global state
- **GitHub Actions compatibility** - Special handling for pythonLocation variants in CI environments

## Public API Coverage

The tests validate the core public functions from `@debugmcp/adapter-python`:
- `findPythonExecutable()` - Main entry point for Python interpreter discovery
- `getPythonVersion()` - Version detection utility  
- `setDefaultCommandFinder()` - Global configuration mechanism

## Integration Points

### Dependencies
- **@debugmcp/adapter-python** - Core adapter functions under test
- **MockCommandFinder** - Test utility for command discovery simulation
- **vitest** - Testing framework with comprehensive mocking
- **child_process** - Mocked for subprocess control
- **node:fs/path** - File system operations for executable validation

### Test Architecture
The directory employs sophisticated mocking strategies to simulate real-world Python environments without requiring actual Python installations, enabling reliable CI/CD testing across different platforms and configurations.