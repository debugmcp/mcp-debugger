# packages/adapter-python/tests/
@generated: 2026-02-10T01:19:52Z

## Overall Purpose

This directory contains the complete test suite for the `@debugmcp/adapter-python` package, providing comprehensive validation of Python debug adapter functionality. The tests ensure reliable creation, initialization, and operation of Python debug adapters across diverse development environments with robust error handling.

## Test Architecture & Organization

The test suite is organized into two complementary layers:

### Smoke Tests (`python-adapter.test.ts`)
- **Package-level validation**: Verifies all public exports are properly exposed
- **Minimal dependency testing**: Confirms classes can be imported and instantiated without complex setup
- **Integration checkpoint**: Catches basic packaging and export issues early in the development cycle

### Comprehensive Unit Tests (`unit/` directory)
- **Factory pattern testing**: Validates `PythonAdapterFactory` creation and configuration logic
- **Adapter lifecycle testing**: Tests `PythonDebugAdapter` initialization, state management, and cleanup
- **Platform utilities testing**: Comprehensive validation of Python environment discovery across Windows, Linux, and macOS

## Key Components & Integration Flow

### Public API Surface Testing
The tests validate the complete public interface:
- `PythonAdapterFactory`: Entry point for adapter creation with metadata and environment validation
- `PythonDebugAdapter`: Core adapter managing initialization state and lifecycle events
- `findPythonExecutable`: Utility function for cross-platform Python discovery

### Integration Validation Pattern
Tests follow a complete integration flow:
1. **Factory Layer**: Creates adapter instances with proper metadata (language support, version requirements, file extensions)
2. **Adapter Layer**: Manages state transitions (UNINITIALIZED → READY/ERROR) and event emission
3. **Utilities Layer**: Handles platform-specific Python discovery and environment validation
4. **Error Propagation**: Ensures consistent error reporting across all architectural layers

## Critical Validation Coverage

### Environment Requirements Testing
- Python version compatibility (>= 3.7 required)
- debugpy package availability verification
- Platform-specific executable discovery and PATH resolution
- Virtual environment detection with appropriate warnings

### Cross-Platform Reliability
- Windows-specific handling (.exe extensions, Windows Store alias filtering)
- Unix-like system PATH resolution
- Environment variable precedence (`PYTHON_EXECUTABLE`, `pythonLocation`, `PythonLocation`)
- CI environment specific error reporting and logging

## Testing Infrastructure & Patterns

### Mock Architecture
- Standardized mock factory functions for consistent test setup
- Comprehensive child process and file system mocking
- Platform behavior simulation with configurable responses
- Environment variable manipulation with proper cleanup

### Error Boundary Testing
- Missing Python installation scenarios
- Incompatible Python version handling
- Missing debugpy dependency failures
- File system and subprocess error conditions
- Graceful degradation and user-friendly error messages

## Internal Organization

The test suite maintains clear separation of concerns while validating end-to-end functionality:
- **Smoke tests** provide rapid feedback on basic functionality
- **Unit tests** ensure comprehensive coverage of all code paths
- **Integration patterns** validate component interaction
- **Platform-specific suites** handle OS-dependent behavior

This comprehensive test coverage ensures the Python debug adapter can reliably initialize and operate across diverse Python environments while providing clear error messaging for common setup issues.