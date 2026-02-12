# packages\adapter-python\tests/
@generated: 2026-02-12T21:01:13Z

## Overall Purpose

The `packages/adapter-python/tests` directory contains a comprehensive test suite for the Python debug adapter package, validating both the public API surface and the underlying Python environment discovery mechanisms. This test directory ensures the adapter can reliably operate across diverse development environments and provides robust error handling for configuration issues.

## Component Integration and Test Architecture

The test suite is organized into two primary layers that mirror the adapter's architecture:

**Smoke Tests Layer (`python-adapter.test.ts`)**
- Lightweight package export validation using Vitest framework
- Verifies critical exports: `PythonAdapterFactory`, `PythonDebugAdapter`, `findPythonExecutable`
- Minimal instantiation testing to catch basic packaging/export issues
- Entry point for CI/CD pipeline validation

**Unit Tests Layer (`unit/` directory)**
- Comprehensive functionality testing with mock-based infrastructure
- Three focused test suites covering the complete adapter pipeline:
  - **Factory Testing**: Adapter creation, metadata retrieval, and environment validation
  - **Adapter Lifecycle Testing**: Initialization, state management, event-driven transitions, and disposal
  - **Discovery Utilities Testing**: Cross-platform Python executable discovery with extensive edge case coverage

## Key Public API Surface Tested

**PythonAdapterFactory Interface**:
- `createAdapter()`: Factory-based adapter instance creation
- `getMetadata()`: Adapter configuration and capabilities metadata
- `validateEnvironment()`: Python environment prerequisite validation (Python ≥3.7, debugpy availability)

**PythonDebugAdapter Interface**:
- `initialize()`: Asynchronous adapter setup with comprehensive environment validation
- `dispose()`: Resource cleanup and lifecycle management
- Event system: 'initialized' events and state change notifications (UNINITIALIZED → READY/ERROR)

**Discovery Utilities**:
- `findPythonExecutable()`: Cross-platform Python discovery with debugpy preference and fallback mechanisms
- Environment variable handling (`PYTHON_EXECUTABLE`, `pythonLocation`)
- Platform-specific installation pattern support (Windows Store Python, virtual environments)

## Internal Organization and Data Flow

**Test Data Flow**:
1. **Export Validation**: Smoke tests verify package structure and basic instantiation
2. **Environment Discovery**: Utilities tests validate Python executable discovery across platforms
3. **Factory Validation**: Factory tests ensure proper adapter creation and environment checking
4. **Adapter Lifecycle**: Adapter tests validate complete initialization, state management, and error handling pipeline

**Mock Infrastructure**:
- Comprehensive subprocess and filesystem mocking for isolated testing
- Platform-specific behavior simulation (Windows vs Unix-like systems)
- Controlled error injection for testing failure scenarios
- Environment preservation/restoration for test isolation

## Important Testing Patterns

**Cross-Platform Coverage**: Extensive testing across Windows (including Windows Store Python), Linux, and macOS with platform-specific installation patterns and PATH resolution mechanisms.

**Error Handling Validation**: Comprehensive error scenario testing with proper error codes, user-friendly messages, and graceful degradation when Python dependencies are unavailable.

**Environment Validation Pipeline**: Multi-layered validation ensuring Python version compatibility, debugpy package availability, and proper fallback mechanisms for various Python installation configurations.

**Mock-First Testing Strategy**: All external dependencies (subprocess execution, file system access, network calls) are mocked to ensure deterministic, fast test execution while maintaining comprehensive coverage of real-world scenarios.