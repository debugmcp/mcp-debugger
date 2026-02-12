# packages\adapter-python\tests\unit/
@generated: 2026-02-12T21:05:47Z

## Purpose & Responsibility

This directory contains comprehensive unit tests for the Python adapter component of the DebugMCP system. The test suite validates Python environment discovery, adapter factory pattern implementation, adapter lifecycle management, and cross-platform Python executable detection functionality.

## Key Components & Integration

### Core Test Files
- **python-adapter-factory.test.ts**: Tests the factory pattern for creating Python debug adapters, validating metadata retrieval and environment validation
- **python-debug-adapter.spec.ts**: Tests the main PythonDebugAdapter class lifecycle including initialization, state management, and error handling
- **python-utils.comprehensive.test.ts**: Extensive cross-platform testing of Python executable discovery with edge cases and error scenarios
- **python-utils.discovery.test.ts**: Focused testing of Python discovery functionality across different environment configurations

### Testing Architecture

**Mock Infrastructure**: All test files share common patterns for mocking system dependencies:
- `child_process.spawn` for simulating Python subprocess execution
- File system operations (`fs.existsSync`) for path validation
- Environment variable manipulation for testing different configurations
- Logger services for validation of error reporting and debugging output

**Test Utilities**: Reusable helper functions across test files:
- `createDependencies()`: Factory for mock adapter dependencies
- `createSpawn()`/`simulateSpawn()`: Helpers for simulating child process behavior
- Environment setup/teardown for isolated testing

## Public API Testing Coverage

### PythonAdapterFactory
- Factory method validation for adapter instance creation
- Metadata structure verification (language, version, file extensions)
- Environment validation with Python version requirements (>=3.7)
- debugpy dependency detection and error handling

### PythonDebugAdapter
- Initialization lifecycle with state transitions (UNINITIALIZED → READY/ERROR)
- Event emission patterns ('initialized' events)
- Error handling and user-friendly error message translation
- Proper resource disposal and cleanup

### Python Discovery Utilities
- Cross-platform Python executable discovery (Windows, Linux, macOS)
- Environment variable precedence (`PYTHON_EXECUTABLE`, `pythonLocation`, `PYTHON_PATH`)
- Windows Store alias detection and filtering
- debugpy module preference logic for development scenarios

## Internal Organization & Data Flow

### Test Flow Patterns
1. **Environment Setup**: Mock system dependencies and preserve original environment
2. **Test Execution**: Exercise functionality with controlled inputs and simulated system responses
3. **Validation**: Verify expected state transitions, error codes, logging messages, and return values
4. **Cleanup**: Restore original environment and clear mocks

### Error Scenario Coverage
- Missing Python executables or incompatible versions
- debugpy module availability issues
- Platform-specific installation problems (Windows Store aliases)
- CI/development environment debugging with verbose logging
- Graceful degradation and fallback mechanisms

## Important Patterns & Conventions

### Testing Standards
- **Vitest Framework**: Consistent use of Vitest for mocking and async testing
- **Type Safety**: Extensive use of TypeScript with proper type casting for private method testing
- **Mock Management**: Systematic mock setup/teardown with `beforeEach`/`afterEach` hooks
- **Platform Testing**: Platform-specific behavior validation using `process.platform` mocking

### Error Handling Validation
- Comprehensive error boundary testing for various failure scenarios
- Structured error reporting with specific error codes (ENVIRONMENT_INVALID, CommandNotFoundError)
- CI-specific logging and debugging output validation
- User-friendly error message translation testing

### Environment Configuration Testing
- Multi-platform Python discovery (Windows PATH vs Unix-like systems)
- Environment variable precedence and override behavior
- Virtual environment detection and handling
- debugpy compatibility checking across Python installations

This test suite ensures reliable Python adapter functionality across diverse development environments while maintaining comprehensive error handling and debugging capabilities.