# packages/adapter-python/tests/unit/
@generated: 2026-02-10T01:19:39Z

## Test Suite for Python Debug Adapter Module

This directory contains comprehensive unit tests for the Python debug adapter implementation, validating all core functionality including adapter factory patterns, adapter lifecycle management, and Python environment discovery utilities.

### Overall Purpose

Provides complete test coverage for the Python debug adapter's ability to:
- Create and configure Python debug adapter instances through factory patterns
- Manage adapter initialization, state transitions, and lifecycle events
- Discover and validate Python installations across multiple platforms (Windows, Linux, macOS)
- Handle environment validation, error scenarios, and graceful degradation

### Key Test Components

**PythonAdapterFactory Tests (`python-adapter-factory.test.ts`)**
- Factory pattern validation for adapter creation
- Metadata verification (language support, version requirements, file extensions)
- Environment validation orchestration (Python >= 3.7, debugpy availability)
- Comprehensive error handling for missing dependencies

**PythonDebugAdapter Tests (`python-debug-adapter.spec.ts`)**
- Adapter initialization and state management (UNINITIALIZED → READY/ERROR)
- Event emission testing ('initialized' events)
- Environment validation coordination
- Lifecycle management and cleanup (dispose operations)
- Error message translation for user-friendly feedback

**Python Discovery Utilities Tests (`python-utils.*.test.ts`)**
- Cross-platform Python executable discovery
- Environment variable handling (`PYTHON_EXECUTABLE`, `pythonLocation`, `PythonLocation`)
- Windows Store alias detection and filtering
- debugpy module preference and fallback logic
- Comprehensive error scenarios and CI-specific logging

### Test Architecture & Patterns

**Mock Infrastructure:**
- Standardized mock factory functions (`createDependencies`, `createSpawn`)
- Comprehensive child process and file system mocking
- Platform-specific behavior simulation
- Environment variable manipulation with proper cleanup

**Test Organization:**
- Unit-level isolation with extensive mocking
- Integration testing between factory, adapter, and utilities
- Error boundary testing for all failure scenarios
- Platform-specific test suites with conditional logic

**Key Testing Utilities:**
- `simulateSpawn()`: Configurable child process simulation
- `setSuccessfulEnvironment()`: Happy path environment setup
- Mock restoration patterns in beforeEach/afterEach hooks
- Comprehensive spy management for logger and system calls

### Critical Validation Logic

**Environment Requirements:**
- Python version validation (>= 3.7 required)
- debugpy package availability verification
- Platform-specific executable discovery (Windows .exe handling, PATH resolution)
- Virtual environment detection and warnings

**Error Handling Coverage:**
- Missing Python installations
- Incompatible Python versions
- Missing debugpy dependencies
- File system and subprocess errors
- CI environment specific error reporting

### Integration Points

The test suite validates the complete integration flow:
1. **Factory** creates adapter instances with proper metadata
2. **Adapter** manages initialization state and environment validation
3. **Utilities** handle platform-specific Python discovery and validation
4. **Error propagation** ensures consistent error reporting across all layers

This comprehensive test coverage ensures reliable Python debug adapter functionality across diverse development environments and provides robust error handling for common Python setup issues.