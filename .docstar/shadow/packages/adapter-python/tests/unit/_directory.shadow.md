# packages/adapter-python/tests/unit/
@generated: 2026-02-09T18:16:08Z

## Purpose
Unit test directory for the Python debug adapter package, providing comprehensive test coverage for Python environment detection, adapter lifecycle management, and debugging infrastructure validation.

## Test Architecture & Organization

### Core Components Under Test
The test suite validates three main components:

1. **PythonAdapterFactory** - Factory pattern implementation for creating Python debug adapters
2. **PythonDebugAdapter** - Main adapter class handling debug sessions and state management  
3. **Python Utilities** - Environment discovery and validation utilities

### Test Structure
All tests use the **Vitest** testing framework with extensive mocking infrastructure:

- **Mock Dependencies**: Comprehensive mocking of Node.js `child_process`, filesystem operations, and external utilities
- **Test Utilities**: Shared helper functions for creating mock dependencies and simulating process behavior
- **Event Simulation**: EventEmitter-based patterns for testing asynchronous adapter operations

## Key Test Categories

### Factory Pattern Testing (`python-adapter-factory.test.ts`)
- Validates adapter creation and metadata retrieval
- Tests environment validation with various Python/debugpy configurations
- Covers success paths and comprehensive error scenarios (missing Python, old versions, missing debugpy)

### Adapter Lifecycle Testing (`python-debug-adapter.spec.ts`)
- Tests initialization, state transitions, and disposal workflows
- Validates event emission patterns during adapter lifecycle
- Error handling and user-friendly error message generation

### Python Discovery Testing (`python-utils.*.test.ts`)
Two comprehensive test suites for Python executable discovery:

- **Discovery Tests**: Platform-specific discovery logic, environment variable handling, debugpy preference
- **Comprehensive Tests**: Edge cases, Windows Store alias filtering, verbose logging, CI environment behavior

## Testing Patterns & Infrastructure

### Mock Strategy
- **Process Simulation**: EventEmitter-based mock processes with configurable exit codes and output
- **Platform Mocking**: Cross-platform testing via `process.platform` and environment variable manipulation
- **Dependency Injection**: Factory functions creating consistent mock `AdapterDependencies`

### Coverage Areas
- **Environment Validation**: Python version requirements, debugpy availability, virtual environment detection
- **Platform Compatibility**: Windows-specific behaviors, PATH handling, executable discovery
- **Error Recovery**: Graceful handling of missing dependencies, spawn failures, and invalid configurations
- **Debug Logging**: Verbose discovery logging and CI failure reporting

## Key Dependencies
- **@debugmcp/shared**: Provides adapter interfaces, state enums, and error codes
- **Vitest**: Primary testing framework with mocking capabilities
- **Node.js Built-ins**: `child_process`, `fs`, `path`, `events` for system integration testing
- **External Tools**: `which` command utility (mocked)

## Public API Testing Surface
The tests validate the public interfaces that consuming code relies on:

- `PythonAdapterFactory.createAdapter()` - Factory method for adapter creation
- `PythonAdapterFactory.getMetadata()` - Adapter metadata and capabilities
- `PythonAdapterFactory.validateEnvironment()` - Environment compatibility checking
- `findPythonExecutable()` - Python discovery utility
- `getPythonVersion()` - Version detection utility

## Internal Testing Focus
- State management and event emission patterns
- Cross-platform Python discovery algorithms
- Environment variable precedence and fallback logic
- Error propagation and user-friendly messaging
- Debug logging and CI-specific behaviors

The test suite ensures robust Python debug adapter functionality across diverse development environments while maintaining comprehensive error handling and user experience standards.