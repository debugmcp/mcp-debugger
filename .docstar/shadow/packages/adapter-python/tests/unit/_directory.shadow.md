# packages\adapter-python\tests\unit/
@generated: 2026-02-12T21:00:58Z

## Unit Testing Directory for Python Debug Adapter

This directory contains comprehensive unit tests for the Python debug adapter implementation, covering factory patterns, adapter lifecycle management, and Python environment discovery utilities.

### Overall Purpose

This test directory validates the complete Python debug adapter functionality, ensuring reliable Python executable discovery, proper adapter initialization, environment validation, and factory-based adapter creation. The tests simulate various real-world scenarios including different operating systems, Python installations, and error conditions.

### Key Test Components

**PythonAdapterFactory Tests (`python-adapter-factory.test.ts`)**
- Validates the factory pattern implementation for creating Python debug adapter instances
- Tests metadata retrieval and adapter configuration consistency
- Comprehensive environment validation including Python version requirements (≥3.7) and debugpy package availability
- Mock-based testing of subprocess execution for environment checks

**PythonDebugAdapter Tests (`python-debug-adapter.spec.ts`)**
- Core adapter lifecycle testing (initialization, state management, disposal)
- Event-driven testing with adapter state transitions (UNINITIALIZED → READY/ERROR)
- Error handling validation with proper error codes and user-friendly messages
- Environment validation testing with multiple failure scenarios

**Python Discovery Utilities Tests**
- **Comprehensive suite** (`python-utils.comprehensive.test.ts`): Extensive cross-platform Python discovery testing with edge cases, Windows Store alias handling, environment variable precedence, and verbose logging
- **Discovery-focused suite** (`python-utils.discovery.test.ts`): Targeted testing of core discovery functionality across Linux/Windows platforms with various configuration scenarios

### Component Integration

The test suites work together to validate the complete adapter pipeline:

1. **Factory Layer**: `PythonAdapterFactory` creates adapter instances and validates environment prerequisites
2. **Adapter Layer**: `PythonDebugAdapter` manages lifecycle, state, and error handling
3. **Discovery Layer**: Python utilities handle cross-platform executable discovery with fallback mechanisms

### Public API Surface Tested

**Factory Interface**:
- `createAdapter()`: Adapter instance creation
- `getMetadata()`: Adapter configuration and capabilities
- `validateEnvironment()`: Environment prerequisite checking

**Adapter Interface**:
- `initialize()`: Async adapter setup with environment validation
- `dispose()`: Cleanup and resource management
- Event emission: 'initialized' events and state change notifications

**Discovery Utilities**:
- `findPythonExecutable()`: Cross-platform Python discovery with debugpy preference
- `getPythonVersion()`: Version extraction and validation
- Environment variable handling (`PYTHON_EXECUTABLE`, `pythonLocation`)

### Testing Patterns & Infrastructure

**Mock Strategy**:
- Comprehensive mocking of child processes, file systems, and external commands
- Platform-specific behavior simulation (Windows vs Unix-like systems)
- Controlled error injection for testing failure scenarios

**Test Utilities**:
- Factory functions for creating mock dependencies and environments
- Helper functions for simulating subprocess execution with configurable outputs
- Environment preservation and restoration for isolated test execution

**Coverage Areas**:
- Cross-platform compatibility (Windows Store Python, PATH resolution)
- Error handling and user-friendly error reporting
- Environment variable precedence and validation
- debugpy module availability checking
- Verbose logging for debugging and CI environments

### Critical Validation Logic

The test suite ensures robust Python environment detection by validating:
- Python version compatibility (minimum 3.7)
- debugpy package availability for debugging functionality
- Proper error reporting for missing dependencies
- Fallback mechanisms when preferred Python installations are unavailable
- Platform-specific installation patterns (Windows Store, virtual environments)

This comprehensive test coverage ensures the Python debug adapter can reliably initialize and operate across diverse development environments while providing clear error reporting for configuration issues.