# tests/unit/adapter-python/python-debug-adapter.test.ts
@source-hash: 680b31f600fe78f8
@generated: 2026-02-10T00:41:37Z

## Test Suite for PythonDebugAdapter

This file contains comprehensive unit tests for the `PythonDebugAdapter` class using Vitest framework. Tests the Python language debug adapter's functionality including environment validation, configuration transformation, and debug session management.

### Test Structure & Setup

- **Mock configuration (L6-17)**: Mocks `child_process` and `python-utils` modules for isolated testing
- **Dependency factory (L19-30)**: `createDependencies()` creates standardized mock dependencies with logger interface
- **Test cleanup (L33-35)**: Automatic mock clearing after each test

### Key Test Categories

#### Environment Validation Tests
- **Executable caching (L37-47)**: Verifies `resolveExecutablePath()` caches results and calls utilities only once
- **Version validation (L49-60)**: Tests environment invalidation for Python versions < 3.7
- **Dependency checking (L62-75)**: Validates debugpy installation detection and virtual environment handling
- **Error handling (L77-85)**: Tests graceful handling of Python executable resolution failures
- **Cache utilization (L87-96)**: Verifies version information caching to avoid redundant checks

#### Command Building & DAP Communication
- **Adapter command (L98-113)**: Tests `buildAdapterCommand()` generates correct debugpy adapter invocation with proper arguments and environment variables
- **Exception filters (L115-129)**: Validates DAP request filtering for exception breakpoints, rejecting invalid filters
- **Event handling (L131-141)**: Tests thread ID tracking from stopped events

#### Feature Support & Requirements
- **Feature detection (L143-151)**: Tests `supportsFeature()` and `getFeatureRequirements()` for various debug capabilities
- **Requirement details (L168-178)**: Validates feature-specific requirement descriptions (debugpy versions, Python versions)

#### Error Translation & User Experience
- **Error message translation (L153-166)**: Tests `translateErrorMessage()` for common Python/debugpy errors with user-friendly messages
- **Installation guidance (L307-312)**: Tests helper methods providing installation instructions and error messages

#### Lifecycle Management
- **Initialization flow (L180-206)**: Tests successful initialization with environment validation and error state transitions
- **Connection management (L208-224)**: Tests state transitions for connect/disconnect operations with event emission
- **Disposal (L280-292)**: Tests proper cleanup and state reset

#### Debugpy Integration
- **Installation detection (L226-260)**: Tests spawn-based debugpy version detection with success/failure scenarios
- **Process management**: Mock EventEmitter setup for child process simulation

#### Configuration Management
- **Launch config transformation (L262-278)**: Tests `transformLaunchConfig()` applying Python-specific defaults
- **Default configuration (L314-322)**: Tests `getDefaultLaunchConfig()` baseline settings
- **Capabilities exposure (L294-305)**: Tests DAP capabilities reporting including exception breakpoint filters

### Architecture Patterns

- Uses dependency injection pattern for testability
- Extensive mocking of external dependencies (file system, process launching, network)
- State machine testing for adapter lifecycle
- Event-driven testing with EventEmitter patterns
- Type casting to access private methods for internal state validation