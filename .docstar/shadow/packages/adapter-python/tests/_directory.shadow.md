# packages\adapter-python\tests/
@generated: 2026-02-12T21:06:03Z

## Overall Purpose & Responsibility

This directory contains the complete test suite for the `@debugmcp/adapter-python` package, providing comprehensive validation of Python debugging adapter functionality within the DebugMCP system. The tests ensure reliable Python environment discovery, adapter lifecycle management, and cross-platform compatibility for debugging Python applications.

## Test Architecture & Organization

### Two-Tier Testing Strategy
- **Smoke Tests** (`python-adapter.test.ts`): Lightweight package-level validation ensuring proper exports and basic instantiation without complex dependencies
- **Unit Tests** (`unit/` directory): Comprehensive behavioral testing with full mock infrastructure and edge case coverage

### Core Test Components

**Factory Pattern Testing** (`unit/python-adapter-factory.test.ts`):
- Validates the PythonAdapterFactory's ability to create adapter instances
- Tests metadata retrieval (language support, version requirements, file extensions)
- Verifies environment validation including Python >=3.7 requirements and debugpy dependency detection

**Adapter Lifecycle Testing** (`unit/python-debug-adapter.spec.ts`):
- Tests complete PythonDebugAdapter initialization lifecycle (UNINITIALIZED → READY/ERROR state transitions)
- Validates event emission patterns and error handling
- Ensures proper resource disposal and cleanup

**Python Discovery Testing** (`unit/python-utils.*.test.ts`):
- Cross-platform Python executable discovery across Windows, Linux, and macOS
- Environment variable precedence testing (`PYTHON_EXECUTABLE`, `pythonLocation`, `PYTHON_PATH`)
- Edge case handling including Windows Store aliases and virtual environments

## Key Testing Patterns & Infrastructure

### Mock System Integration
All unit tests share a common mocking infrastructure:
- `child_process.spawn` simulation for Python subprocess execution
- File system operations (`fs.existsSync`) for path validation  
- Environment variable manipulation for configuration testing
- Logger service mocking for debugging output validation

### Test Utilities & Helpers
- `createDependencies()`: Factory for creating mock adapter dependencies
- `createSpawn()`/`simulateSpawn()`: Helpers for simulating child process behavior with controlled outputs
- Environment setup/teardown utilities for isolated test execution

## Public API Coverage

### Validated Entry Points
- **PythonAdapterFactory**: Factory method validation, metadata structure verification, environment validation
- **PythonDebugAdapter**: Initialization lifecycle, state management, event emission, error handling
- **findPythonExecutable**: Cross-platform Python discovery utility with fallback mechanisms

### Error Handling Validation
The test suite comprehensively validates error scenarios:
- Missing or incompatible Python installations
- debugpy module availability issues
- Platform-specific installation problems (Windows Store Python aliases)
- Graceful degradation and user-friendly error message translation

## Cross-Platform Testing Strategy

The tests ensure adapter functionality across diverse development environments:
- **Windows**: PATH-based discovery, Windows Store alias detection and filtering
- **Unix-like systems**: Standard executable discovery patterns
- **Development environments**: debugpy module preference for development scenarios
- **CI environments**: Verbose logging and debugging output validation

## Integration with DebugMCP System

This test suite validates the Python adapter's role as a language-specific component within the broader DebugMCP debugging infrastructure, ensuring:
- Proper factory pattern implementation for adapter instantiation
- Consistent state management and event emission patterns
- Reliable environment discovery and validation across platforms
- Comprehensive error reporting and debugging capabilities

The tests provide confidence that the Python adapter can reliably discover Python installations, validate debugging prerequisites, and integrate seamlessly with the DebugMCP debugging workflow.