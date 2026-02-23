# packages\adapter-python\tests/
@children-hash: fbe69c0deee7658d
@generated: 2026-02-23T15:26:48Z

## Purpose
This directory contains the complete test suite for the `@debugmcp/adapter-python` package, providing comprehensive validation of Python debugging environment discovery, adapter factory patterns, and integration with the MCP system. The tests ensure reliable Python executable detection across platforms, proper debugpy integration, and robust error handling for diverse deployment scenarios.

## Test Architecture

### Test Organization
- **Package-level smoke tests** (`python-adapter.test.ts`): Basic export validation and instantiation checks
- **Unit test suite** (`unit/`): Comprehensive testing of core functionality including:
  - Python environment discovery utilities
  - Adapter factory pattern implementation  
  - Debug adapter lifecycle management
  - Cross-platform compatibility validation

### Key Testing Components

**PythonAdapterFactory Testing**
- Validates factory pattern for creating Python debug adapters
- Tests environment validation logic and metadata accuracy
- Covers critical edge cases like system Python without debugpy
- Ensures proper distinction between hard failures (missing Python) and warnings (missing debugpy)

**PythonDebugAdapter Testing**
- Tests adapter initialization, state management, and lifecycle transitions
- Validates event emission patterns and error handling
- Covers integration with environment validation systems
- Tests cleanup procedures and resource management

**Python Discovery Testing**
- Comprehensive cross-platform Python executable discovery (Windows, Linux, macOS)
- Environment variable precedence testing (`PYTHON_EXECUTABLE`, `pythonLocation`, `PYTHON_PATH`)
- Windows-specific behavior validation (Store aliases, .exe extensions)
- debugpy module detection and preference logic
- Virtual environment vs system Python handling

## Testing Patterns & Infrastructure

### Common Testing Infrastructure
- **Mock Factories**: Standardized dependency creation for consistent test setup
- **Platform Simulation**: Cross-platform testing using `process.platform` mocking
- **Environment Management**: Systematic environment variable manipulation with cleanup
- **Async Process Simulation**: EventEmitter-based child process mocking with configurable outputs

### Critical Coverage Areas
- **Multi-platform compatibility**: Ensures Python discovery works across Windows, Linux, and macOS
- **Environment validation**: Tests both blocking errors (Python version) and warnings (debugpy availability)
- **Edge case handling**: Covers real-world scenarios like Issue #16 (system Python without debugpy)
- **State management**: Validates adapter lifecycle transitions (UNINITIALIZED → READY → ERROR)
- **Error propagation**: Tests user-friendly error message translation and handling

## Public API Validation

The test suite validates the main entry points of the adapter-python package:
- **PythonAdapterFactory**: Factory class for creating Python debug adapters
- **PythonDebugAdapter**: Main adapter implementation for Python debugging
- **findPythonExecutable**: Utility function for Python environment discovery

## Integration Points

The tests ensure seamless integration between:
- Python environment discovery utilities and adapter factory
- Factory validation logic and adapter initialization
- Cross-platform discovery mechanisms and debugpy integration
- Error handling systems and user feedback mechanisms
- MCP adapter lifecycle and Python-specific debugging capabilities

## Testing Strategy

The test suite follows a layered approach:
1. **Smoke tests** verify basic package exports and instantiation
2. **Unit tests** validate individual component functionality
3. **Integration tests** ensure components work together correctly
4. **Cross-platform tests** verify behavior across different operating systems
5. **Edge case tests** cover real-world deployment scenarios and failure modes

This comprehensive testing approach ensures the Python adapter can reliably discover and validate Python environments across diverse deployment scenarios while providing meaningful error messages and graceful degradation when dependencies are partially available.